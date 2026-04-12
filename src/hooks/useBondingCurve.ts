import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import {
  getBondingCurve,
  getBondingCurveWrite,
  type ArenaMetrics,
} from "@/lib/contracts";

export interface QuoteResult {
  amountOut: bigint;
  fee: bigint;
  priceImpactBps: bigint;
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

  // Quote buy
  const quoteBuy = useCallback(
    async (usdcAmount: string): Promise<QuoteResult | null> => {
      if (!curveAddress) return null;
      try {
        const curve = getBondingCurve(curveAddress, readProvider);
        const amountWei = ethers.parseEther(usdcAmount);
        const result = await curve.quoteBuy(amountWei);
        return {
          amountOut: result[0],
          fee: result[1],
          priceImpactBps: result[2],
        };
      } catch {
        return null;
      }
    },
    [curveAddress, readProvider]
  );

  // Quote sell
  const quoteSell = useCallback(
    async (tokenAmount: string): Promise<QuoteResult | null> => {
      if (!curveAddress) return null;
      try {
        const curve = getBondingCurve(curveAddress, readProvider);
        const amountWei = ethers.parseEther(tokenAmount);
        const result = await curve.quoteSell(amountWei);
        return {
          amountOut: result[0],
          fee: result[1],
          priceImpactBps: result[2],
        };
      } catch {
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
