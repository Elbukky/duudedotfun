import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import { useBondingCurve, type QuoteResult } from "@/hooks/useBondingCurve";
import { usePostMigrationPool } from "@/hooks/usePostMigrationPool";
import { getLaunchToken, getLaunchTokenWrite, formatUSDC, formatTokenAmount } from "@/lib/contracts";
import { toast } from "sonner";

interface BuySellPanelProps {
  curveAddress: string | null;
  tokenAddress: string | null;
  tokenSymbol: string;
  graduated: boolean;
  poolAddress: string | null;
}

const BuySellPanel = ({ curveAddress, tokenAddress, tokenSymbol, graduated, poolAddress }: BuySellPanelProps) => {
  const { signer, isConnected, readProvider, address: userAddress } = useWeb3();
  const curve = useBondingCurve(graduated ? null : curveAddress);
  const pool = usePostMigrationPool(graduated ? poolAddress : null);

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [poolQuote, setPoolQuote] = useState<{ amountOut: bigint; fee: bigint } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [userBalance, setUserBalance] = useState<bigint>(0n);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);

  // Fetch user balances
  useEffect(() => {
    if (!userAddress) return;
    const fetchBalances = async () => {
      try {
        const bal = await readProvider.getBalance(userAddress);
        setUserBalance(bal);
      } catch {}
      if (tokenAddress) {
        try {
          const token = getLaunchToken(tokenAddress, readProvider);
          const bal = await token.balanceOf(userAddress);
          setTokenBalance(bal);
        } catch {}
      }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [userAddress, tokenAddress, readProvider]);

  // Debounced quote fetching
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      setPoolQuote(null);
      return;
    }
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        if (graduated) {
          const stats = await pool.getPoolStats();
          if (stats && stats.tokenReserve > 0n && stats.usdcReserve > 0n) {
            const feeBps = 40n; // 0.40% fixed DEX fee
            if (mode === "buy") {
              const usdcIn = ethers.parseEther(amount);
              // Fee is deducted from USDC input
              const usdcInNet = (usdcIn * (10000n - feeBps)) / 10000n;
              const fee = usdcIn - usdcInNet;
              const tokensOut = (usdcInNet * stats.tokenReserve) / (stats.usdcReserve + usdcInNet);
              setPoolQuote({ amountOut: tokensOut, fee });
            } else {
              const tokensIn = ethers.parseEther(amount);
              // AMM: gross USDC output from selling tokensIn
              const usdcOutGross = (tokensIn * stats.usdcReserve) / (stats.tokenReserve + tokensIn);
              // Fee is deducted from USDC output
              const usdcOutNet = (usdcOutGross * (10000n - feeBps)) / 10000n;
              const fee = usdcOutGross - usdcOutNet;
              setPoolQuote({ amountOut: usdcOutNet, fee });
            }
          }
        } else {
          const result =
            mode === "buy" ? await curve.quoteBuy(amount) : await curve.quoteSell(amount);
          setQuote(result);
        }
      } catch {
        setQuote(null);
        setPoolQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [amount, mode, graduated, curve.quoteBuy, curve.quoteSell, pool.getPoolStats]);

  // Check approval for sell mode
  useEffect(() => {
    if (mode !== "sell" || !tokenAddress || !userAddress || !amount || parseFloat(amount) <= 0) {
      setNeedsApproval(false);
      return;
    }
    const spender = graduated && poolAddress ? poolAddress : curveAddress;
    if (!spender) {
      setNeedsApproval(false);
      return;
    }
    const check = async () => {
      try {
        const token = getLaunchToken(tokenAddress, readProvider);
        const allowance = await token.allowance(userAddress, spender);
        setNeedsApproval(allowance < ethers.parseEther(amount));
      } catch {
        setNeedsApproval(true);
      }
    };
    check();
  }, [mode, tokenAddress, curveAddress, poolAddress, graduated, userAddress, amount, readProvider]);

  const handleApprove = async () => {
    if (!signer || !tokenAddress) return;
    const spender = graduated && poolAddress ? poolAddress : curveAddress;
    if (!spender) return;
    setApproving(true);
    try {
      const token = getLaunchTokenWrite(tokenAddress, signer);
      const tx = await token.approve(spender, ethers.MaxUint256);
      toast.info("Approving tokens...");
      await tx.wait();
      setNeedsApproval(false);
      toast.success("Approved!");
    } catch (err: any) {
      toast.error(err.reason || err.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleTrade = async () => {
    if (!isConnected || !amount || parseFloat(amount) <= 0) return;
    try {
      if (graduated) {
        if (mode === "buy") {
          const usdcIn = ethers.parseEther(amount);
          const minTokensOut = poolQuote ? (poolQuote.amountOut * 97n) / 100n : 0n;
          toast.info("Confirming buy...");
          await pool.swap(minTokensOut, 0n, usdcIn);
          toast.success(`Bought ${tokenSymbol}!`);
        } else {
          const tokensIn = ethers.parseEther(amount);
          // Apply 3% slippage tolerance to usdcOut. The pool swap is
          // output-specified: we request usdcOut and the contract computes
          // how many tokens to take. If reserves shifted since the quote,
          // the actual output may differ — 3% buffer prevents reverts.
          const usdcOut = poolQuote ? (poolQuote.amountOut * 97n) / 100n : 0n;
          toast.info("Confirming sell...");
          await pool.swap(0n, usdcOut, tokensIn);
          toast.success(`Sold ${tokenSymbol}!`);
        }
      } else {
        if (mode === "buy") {
          const minOut = quote ? (quote.amountOut * 98n) / 100n : 0n;
          toast.info("Confirming buy...");
          await curve.buy(amount, minOut);
          toast.success(`Bought ${tokenSymbol}!`);
        } else {
          const minOut = quote ? (quote.amountOut * 98n) / 100n : 0n;
          toast.info("Confirming sell...");
          await curve.sell(amount, minOut);
          toast.success(`Sold ${tokenSymbol}!`);
        }
      }
      setAmount("");
      setQuote(null);
      setPoolQuote(null);
    } catch (err: any) {
      toast.error(err.reason || err.message || "Transaction failed");
    }
  };

  const handleQuickAmount = (v: string) => {
    if (mode === "buy") {
      setAmount(v);
    } else {
      const pct = parseInt(v);
      if (tokenBalance > 0n) {
        const amt = (tokenBalance * BigInt(pct)) / 100n;
        setAmount(ethers.formatEther(amt));
      }
    }
  };

  const activeQuote = graduated ? poolQuote : quote;
  const isBusy = curve.buying || curve.selling || pool.swapping;

  return (
    <div className="card-cartoon">
      {/* Balance display */}
      {isConnected && userAddress && (
        <div className="flex justify-between items-center text-xs font-body bg-muted/30 rounded-lg px-3 py-2 mb-3 border border-primary/10">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">USDC:</span>
            <span className="text-foreground font-display">{formatUSDC(userBalance)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{tokenSymbol}:</span>
            <span className="text-foreground font-display">{formatTokenAmount(tokenBalance)}</span>
          </div>
        </div>
      )}

      {/* Buy/Sell tabs */}
      <div className="flex rounded-xl overflow-hidden border-2 border-primary/30 mb-4">
        <motion.button
          className={`flex-1 py-3 font-display text-sm transition-colors ${mode === "buy" ? "bg-secondary/20 text-secondary" : "text-muted-foreground"}`}
          onClick={() => {
            setMode("buy");
            setAmount("");
            setQuote(null);
            setPoolQuote(null);
          }}
          whileTap={{ scale: 0.97 }}
        >
          BUY
        </motion.button>
        <motion.button
          className={`flex-1 py-3 font-display text-sm transition-colors ${mode === "sell" ? "bg-destructive/20 text-destructive" : "text-muted-foreground"}`}
          onClick={() => {
            setMode("sell");
            setAmount("");
            setQuote(null);
            setPoolQuote(null);
          }}
          whileTap={{ scale: 0.97 }}
        >
          SELL
        </motion.button>
      </div>

      {graduated && (
        <div className="text-xs text-accent font-body mb-3 text-center">
          Trading on graduated DEX pool
        </div>
      )}

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground font-body">
              {mode === "buy" ? "Amount (USDC)" : `Amount (${tokenSymbol})`}
            </label>
            {isConnected && (
              <button
                onClick={() => {
                  if (mode === "buy" && userBalance > 0n) {
                    // Leave buffer for gas — max(1% of balance, 0.1 USDC)
                    const pctBuffer = userBalance / 100n; // 1%
                    const minBuffer = ethers.parseEther("0.1");
                    const buffer = pctBuffer > minBuffer ? pctBuffer : minBuffer;
                    const maxUsdc = userBalance > buffer
                      ? userBalance - buffer
                      : 0n;
                    if (maxUsdc > 0n) setAmount(ethers.formatEther(maxUsdc));
                  } else if (mode === "sell" && tokenBalance > 0n) {
                    setAmount(ethers.formatEther(tokenBalance));
                  }
                }}
                className="text-[10px] font-body text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                MAX
              </button>
            )}
          </div>
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Quick amount buttons */}
        <div className="flex gap-2">
          {(mode === "buy" ? ["1", "5", "10", "50"] : ["25", "50", "75", "100"]).map((v) => (
            <motion.button
              key={v}
              onClick={() => handleQuickAmount(v)}
              className="flex-1 py-2 rounded-lg bg-muted border border-primary/20 text-xs font-body text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {mode === "buy" ? `${v} USDC` : `${v}%`}
            </motion.button>
          ))}
        </div>

        {/* Quote display */}
        {amount && parseFloat(amount) > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-muted rounded-xl p-3 space-y-1"
          >
            {quoting ? (
              <p className="text-xs text-muted-foreground font-body animate-pulse">
                Fetching quote...
              </p>
            ) : activeQuote ? (
              <>
                <div className="flex justify-between text-xs font-body">
                  <span className="text-muted-foreground">
                    You {mode === "buy" ? "get" : "receive"}
                  </span>
                  <span className="text-foreground">
                    {mode === "buy"
                      ? `${formatTokenAmount(activeQuote.amountOut)} ${tokenSymbol}`
                      : `${formatUSDC(activeQuote.amountOut)} USDC`}
                  </span>
                </div>
                {!graduated && quote && (
                  <>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="text-foreground">{formatUSDC(quote.fee)} USDC</span>
                    </div>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Price impact</span>
                      <span
                        className={
                          Number(quote.priceImpactBps) > 300 ? "text-destructive" : "text-accent"
                        }
                      >
                        {(Number(quote.priceImpactBps) / 100).toFixed(2)}%
                      </span>
                    </div>
                    {quote.willGraduate && (
                      <div className="mt-2 p-2.5 rounded-lg bg-secondary/10 border border-secondary/30 space-y-1">
                        <p className="text-xs font-display text-secondary">
                          This buy will graduate the token!
                        </p>
                        {quote.cappedUsdcIn !== undefined && (
                          <div className="flex justify-between text-xs font-body">
                            <span className="text-muted-foreground">USDC spent</span>
                            <span className="text-foreground">{formatUSDC(quote.cappedUsdcIn)} USDC</span>
                          </div>
                        )}
                        {quote.refundAmount !== undefined && quote.refundAmount > 0n && (
                          <div className="flex justify-between text-xs font-body">
                            <span className="text-muted-foreground">Refunded to you</span>
                            <span className="text-secondary">{formatUSDC(quote.refundAmount)} USDC</span>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground font-body">
                          Token moves to DEX pool after graduation. Excess USDC is auto-refunded.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {graduated && (
                  <div className="flex justify-between text-xs font-body">
                    <span className="text-muted-foreground">Fee</span>
                    <span className="text-foreground">0.40%</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground font-body">Unable to fetch quote</p>
            )}
          </motion.div>
        )}

        {/* Action buttons */}
        {!isConnected ? (
          <p className="text-xs text-center text-muted-foreground font-body py-2">
            Connect wallet to trade
          </p>
        ) : mode === "sell" && needsApproval ? (
          <motion.button
            onClick={handleApprove}
            disabled={approving}
            className="w-full btn-arcade py-3 text-sm bg-accent text-accent-foreground border-accent disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {approving ? "Approving..." : `Approve ${tokenSymbol}`}
          </motion.button>
        ) : (
          <motion.button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isBusy}
            className={`w-full btn-arcade py-3 text-sm ${
              mode === "buy"
                ? "bg-secondary text-secondary-foreground border-secondary"
                : "bg-destructive text-destructive-foreground border-destructive"
            } disabled:opacity-50`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isBusy
              ? "Confirming..."
              : !graduated && mode === "buy" && quote?.willGraduate
                ? `BUY & GRADUATE ${tokenSymbol}`
                : `${mode === "buy" ? "BUY" : "SELL"} ${tokenSymbol}`}
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default BuySellPanel;
