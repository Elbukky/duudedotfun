import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import {
  getBondingCurve,
  getBondingCurveWrite,
  type ArenaMetrics,
} from "@/lib/contracts";

const GRADUATION_TARGET = ethers.parseEther("5000");
const FEE_BPS = 60n;
const BPS = 10000n;

export interface QuoteResult {
  amountOut: bigint;
  fee: bigint;
  priceImpactBps: bigint;
  /** True if this buy will trigger graduation */
  willGraduate?: boolean;
  /** USDC refunded to the buyer (only when willGraduate) */
  refundAmount?: bigint;
  /** Actual USDC spent (may be less than input if capped for graduation) */
  cappedUsdcIn?: bigint;
}

export function useBondingCurve(curveAddress: string | null) {
  const { readProvider, signer, isConnected } = useWeb3();
  const [buying, setBuying] = useState(false);
  const [selling, setSelling] = useState(false);

  // Get spot price
  const getSpotPrice = useCallback(async (): Promise<bigint> => {
    if (!curveAddress) return 0n;
    try {
      const curve = getBondingCurve(curveAddress, readProvider);
      return await curve.spotPrice();
    } catch {
      return 0n;
    }
  }, [curveAddress, readProvider]);

  // Get bonding curve state
  const getCurveState = useCallback(async () => {
    if (!curveAddress) return null;
    try {
      const curve = getBondingCurve(curveAddress, readProvider);
      const [spotPrice, realUSDCRaised, realTokensSold, graduated] = await Promise.all([
        curve.spotPrice(),
        curve.realUSDCRaised(),
        curve.realTokensSold(),
        curve.graduated(),
      ]);
      return { spotPrice, realUSDCRaised, realTokensSold, graduated };
    } catch {
      return null;
    }
  }, [curveAddress, readProvider]);

  // Get arena metrics
  const getArenaMetrics = useCallback(async (): Promise<ArenaMetrics | null> => {
    if (!curveAddress) return null;
    try {
      const curve = getBondingCurve(curveAddress, readProvider);
      const m = await curve.getArenaMetrics();
      return {
        totalBuyVolume: m[0],
        totalSellVolume: m[1],
        buyCount: m[2],
        sellCount: m[3],
        uniqueBuyerCount: m[4],
        holderCount: m[5],
        retainedBuyers: m[6],
        buyPressureBps: m[7],
        percentCompleteBps: m[8],
      };
    } catch {
      return null;
    }
  }, [curveAddress, readProvider]);

  // Quote buy — GRADUATION-AWARE
  // If the buy amount exceeds what's needed to graduate, cap the quote.
  // The contract does partial-fill + refund automatically, but the quote
  // must match so the slippage check (minTokensOut) doesn't revert.
  const quoteBuy = useCallback(
    async (usdcAmount: string): Promise<QuoteResult | null> => {
      if (!curveAddress) return null;
      try {
        const curve = getBondingCurve(curveAddress, readProvider);
        const amountWei = ethers.parseEther(usdcAmount);

        // Check how much is left before graduation
        const realUSDCRaised: bigint = await curve.realUSDCRaised();
        const remaining = GRADUATION_TARGET - realUSDCRaised;

        // Net USDC after 0.6% fee
        const netUsdc = amountWei - (amountWei * FEE_BPS) / BPS;

        let willGraduate = false;
        let refundAmount = 0n;
        let cappedUsdcIn = amountWei;

        if (netUsdc >= remaining && remaining > 0n) {
          willGraduate = true;
          // Calculate the gross amount needed to produce exactly `remaining` net
          // grossUsed = remaining * BPS / (BPS - FEE_BPS), rounded up
          const grossUsed =
            (remaining * BPS + (BPS - FEE_BPS - 1n)) / (BPS - FEE_BPS);
          refundAmount = amountWei - grossUsed;
          cappedUsdcIn = grossUsed;
        }

        // Quote with the (possibly capped) amount
        const result = await curve.quoteBuy(cappedUsdcIn);
        const fee = (cappedUsdcIn * FEE_BPS) / BPS;

        return {
          amountOut: result[0],
          fee,
          priceImpactBps: result[1],
          willGraduate,
          refundAmount,
          cappedUsdcIn,
        };
      } catch (err) {
        console.error("quoteBuy failed:", err);
        return null;
      }
    },
    [curveAddress, readProvider]
  );

  // Quote sell
  // ABI: quoteSell(tokensIn) returns (usdcOut, priceImpactBps) — 2 values
  const quoteSell = useCallback(
    async (tokenAmount: string): Promise<QuoteResult | null> => {
      if (!curveAddress) return null;
      try {
        const curve = getBondingCurve(curveAddress, readProvider);
        const amountWei = ethers.parseEther(tokenAmount);
        const result = await curve.quoteSell(amountWei);
        const usdcOut: bigint = result[0];
        // Fee = 0.6% of gross USDC output (fee deducted, result is net)
        const grossApprox = (usdcOut * BPS) / (BPS - FEE_BPS);
        const fee = grossApprox - usdcOut;
        return {
          amountOut: usdcOut,
          fee,
          priceImpactBps: result[1],
        };
      } catch (err) {
        console.error("quoteSell failed:", err);
        return null;
      }
    },
    [curveAddress, readProvider]
  );

  // Buy tokens
  const buy = useCallback(
    async (usdcAmount: string, minTokensOut: bigint = 0n, recipient?: string) => {
      if (!signer || !isConnected || !curveAddress) throw new Error("Not connected");
      setBuying(true);
      try {
        const curve = getBondingCurveWrite(curveAddress, signer);
        const value = ethers.parseEther(usdcAmount);
        const to = recipient || await signer.getAddress();
        const tx = await curve.buy(minTokensOut, to, { value });
        const receipt = await tx.wait();
        return receipt;
      } finally {
        setBuying(false);
      }
    },
    [signer, isConnected, curveAddress]
  );

  // Sell tokens
  const sell = useCallback(
    async (tokenAmount: string, minUSDCOut: bigint = 0n) => {
      if (!signer || !isConnected || !curveAddress) throw new Error("Not connected");
      setSelling(true);
      try {
        const curve = getBondingCurveWrite(curveAddress, signer);
        const amount = ethers.parseEther(tokenAmount);
        const tx = await curve.sell(amount, minUSDCOut);
        const receipt = await tx.wait();
        return receipt;
      } finally {
        setSelling(false);
      }
    },
    [signer, isConnected, curveAddress]
  );

  return {
    getSpotPrice,
    getCurveState,
    getArenaMetrics,
    quoteBuy,
    quoteSell,
    buy,
    sell,
    buying,
    selling,
  };
}
