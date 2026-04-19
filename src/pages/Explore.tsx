import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import { Search, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useTokenData, type EnrichedToken } from "@/lib/tokenDataProvider";
import { useWeb3 } from "@/lib/web3Provider";
import {
  getBondingCurve,
  getBondingCurveWrite,
  getPostMigrationPool,
  getPostMigrationPoolWrite,
  getLaunchToken,
  getLaunchTokenWrite,
  computeScore,
  formatPriceNum,
  formatNumber,
  type ArenaMetrics,
} from "@/lib/contracts";
import { shortAddress } from "@/lib/arcscan";
import { toast } from "sonner";
import { parseTransactionError } from "@/lib/errors";

// ── Constants ──────────────────────────────────────────────
const PAGE_SIZE = 25;
const TOTAL_SUPPLY = 100_000_000_000; // 100B tokens
const INITIAL_PRICE = 5e-9; // VIRTUAL_USDC / VIRTUAL_TOKENS = 500 / 100B
const QUOTE_DEBOUNCE_MS = 300;

// Arcscan API for 24h data
const ARCSCAN_BASE = "https://testnet.arcscan.app/api/v2";
const BUY_TOPIC = ethers.id("Buy(address,address,uint256,uint256,uint256)");
const SELL_TOPIC = ethers.id("Sell(address,uint256,uint256,uint256)");
const SWAP_TOPIC = ethers.id(
  "Swap(address,address,uint256,uint256,uint256,uint256)"
);
const BONDING_IFACE = new ethers.Interface([
  "event Buy(address indexed buyer, address indexed recipient, uint256 usdcIn, uint256 tokensOut, uint256 fee)",
  "event Sell(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee)",
]);
const POOL_IFACE = new ethers.Interface([
  "event Swap(address indexed sender, address indexed to, uint256 tokenIn, uint256 usdcIn, uint256 tokenOut, uint256 usdcOut)",
]);

type SortKey = "movers" | "recent" | "mcap" | "volume" | "change";
type TradeMode = "buy" | "sell";

interface Data24h {
  priceChange: number;
  volume: number;
}

interface ProcessedToken {
  et: EnrichedToken;
  price: number;
  mcap: number;
  volume: number;
  bondingPct: number;
  hype: number;
  badge: { label: string; color: string } | null;
}

// ── Helpers ────────────────────────────────────────────────

function formatAge(createdAt: number): string {
  const diff = Math.floor(Date.now() / 1000) - createdAt;
  if (diff < 0) return "now";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function getStatusBadge(
  et: EnrichedToken,
  priceChangePct: number
): { label: string; color: string } | null {
  const age = Math.floor(Date.now() / 1000) - Number(et.record.createdAt);
  const trades = Number(et.buyCount) + Number(et.sellCount);

  if (priceChangePct > 50 && Number(et.buyPressureBps) > 6000 && trades > 3)
    return {
      label: "MOONING",
      color: "bg-secondary/20 text-secondary border-secondary/30",
    };
  if (trades > 10 || (Number(et.buyCount) > 5 && Number(et.sellCount) > 2))
    return {
      label: "HOT",
      color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    };
  if (priceChangePct < -10 || (Number(et.buyPressureBps) < 2500 && trades > 3))
    return {
      label: "DIPPING",
      color: "bg-destructive/20 text-destructive border-destructive/30",
    };
  if (age < 7200)
    return {
      label: "NEW",
      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    };
  return null;
}

function cleanTopics(topics: (string | null)[]): string[] {
  return topics.filter((t): t is string => t != null);
}

/** Fetch Arcscan logs for a single address (no pagination — returns latest batch) */
async function fetchLogs(addr: string): Promise<any[]> {
  try {
    const r = await fetch(`${ARCSCAN_BASE}/addresses/${addr}/logs`);
    if (!r.ok) return [];
    const d = await r.json();
    return d.items || [];
  } catch {
    return [];
  }
}

/** Compute 24h price change & volume for one token from Arcscan logs */
async function compute24hForToken(
  curveAddr: string,
  poolAddr: string | undefined,
  currentPrice: number
): Promise<Data24h> {
  const now = Date.now() / 1000;
  const cutoff = now - 86400;

  interface Trade {
    price: number;
    usdcAmount: number;
    ts: number;
  }
  const trades: Trade[] = [];

  // Fetch curve logs + pool logs in parallel
  const [curveLogs, poolLogs] = await Promise.all([
    fetchLogs(curveAddr),
    poolAddr && poolAddr !== ethers.ZeroAddress ? fetchLogs(poolAddr) : [],
  ]);

  // Parse bonding curve events
  for (const log of curveLogs) {
    try {
      if (!log.topics?.[0]) continue;
      const t0 = log.topics[0].toLowerCase();
      const topics = cleanTopics(log.topics);
      const ts = log.block_timestamp
        ? new Date(log.block_timestamp).getTime() / 1000
        : 0;
      if (ts < cutoff) continue;

      if (t0 === BUY_TOPIC.toLowerCase()) {
        const p = BONDING_IFACE.parseLog({ topics, data: log.data });
        if (p) {
          const usdc = parseFloat(ethers.formatEther(p.args.usdcIn));
          const tok = parseFloat(ethers.formatEther(p.args.tokensOut));
          if (tok > 0) trades.push({ price: usdc / tok, usdcAmount: usdc, ts });
        }
      } else if (t0 === SELL_TOPIC.toLowerCase()) {
        const p = BONDING_IFACE.parseLog({ topics, data: log.data });
        if (p) {
          const tok = parseFloat(ethers.formatEther(p.args.tokensIn));
          const usdc = parseFloat(ethers.formatEther(p.args.usdcOut));
          if (tok > 0) trades.push({ price: usdc / tok, usdcAmount: usdc, ts });
        }
      }
    } catch {
      /* skip */
    }
  }

  // Parse pool Swap events
  for (const log of poolLogs) {
    try {
      if (!log.topics?.[0]) continue;
      const t0 = log.topics[0].toLowerCase();
      if (t0 !== SWAP_TOPIC.toLowerCase()) continue;
      const topics = cleanTopics(log.topics);
      const ts = log.block_timestamp
        ? new Date(log.block_timestamp).getTime() / 1000
        : 0;
      if (ts < cutoff) continue;

      const p = POOL_IFACE.parseLog({ topics, data: log.data });
      if (!p) continue;
      const { usdcIn, tokenOut, tokenIn, usdcOut } = p.args;
      if (usdcIn > 0n && tokenOut > 0n) {
        const u = parseFloat(ethers.formatEther(usdcIn));
        const t = parseFloat(ethers.formatEther(tokenOut));
        if (t > 0) trades.push({ price: u / t, usdcAmount: u, ts });
      } else if (tokenIn > 0n && usdcOut > 0n) {
        const t = parseFloat(ethers.formatEther(tokenIn));
        const u = parseFloat(ethers.formatEther(usdcOut));
        if (t > 0) trades.push({ price: u / t, usdcAmount: u, ts });
      }
    } catch {
      /* skip */
    }
  }

  if (trades.length === 0) return { priceChange: 0, volume: 0 };

  trades.sort((a, b) => a.ts - b.ts);
  const oldestPrice = trades[0].price;
  const volume = trades.reduce((s, t) => s + t.usdcAmount, 0);
  const priceChange =
    oldestPrice > 0 ? ((currentPrice - oldestPrice) / oldestPrice) * 100 : 0;

  return { priceChange, volume };
}

// ── Main Component ─────────────────────────────────────────

const Explore = () => {
  const { enrichedTokens, loading, refresh } = useTokenData();
  const { readProvider, signer, address: userAddress, isConnected } = useWeb3();

  // UI state
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("movers");
  const [page, setPage] = useState(1);

  // 24h background data
  const [data24h, setData24h] = useState<Record<string, Data24h>>({});
  const fetching24hRef = useRef(false);

  // Trade panel state
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [tradeMode, setTradeMode] = useState<TradeMode>("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [quoteResult, setQuoteResult] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const quoteTimer = useRef<ReturnType<typeof setTimeout>>();
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);

  // ── Process tokens ──
  const processed = useMemo<ProcessedToken[]>(() => {
    return enrichedTokens.map((et) => {
      const price =
        et.record.graduated && et.poolSpotPrice > 0n
          ? parseFloat(ethers.formatEther(et.poolSpotPrice))
          : parseFloat(ethers.formatEther(et.spotPrice));
      const mcap = price * TOTAL_SUPPLY;
      const volume = parseFloat(
        ethers.formatEther(
          et.totalBuyVolume + et.totalSellVolume + et.postMigrationVolume
        )
      );
      const bondingPct = Number(et.bondingProgressBps) / 100;

      // All-time change from initial virtual price (used as fallback)
      const allTimeChange =
        INITIAL_PRICE > 0
          ? ((price - INITIAL_PRICE) / INITIAL_PRICE) * 100
          : 0;

      const metrics: ArenaMetrics = {
        totalBuyVolume: et.totalBuyVolume,
        totalSellVolume: et.totalSellVolume,
        buyCount: et.buyCount,
        sellCount: et.sellCount,
        uniqueBuyerCount: et.uniqueBuyerCount,
        holderCount: et.holderCount,
        retainedBuyers: et.retainedBuyers,
        buyPressureBps: et.buyPressureBps,
        percentCompleteBps: et.bondingProgressBps,
      };
      const hype = computeScore(metrics);
      const badge = getStatusBadge(et, allTimeChange);

      return { et, price, mcap, volume, bondingPct, hype, badge };
    });
  }, [enrichedTokens]);

  // ── Filter & Sort & Paginate ──
  const filtered = useMemo(() => {
    if (!search.trim()) return processed;
    const q = search.toLowerCase();
    return processed.filter(
      (t) =>
        t.et.record.name.toLowerCase().includes(q) ||
        t.et.record.symbol.toLowerCase().includes(q) ||
        t.et.record.token.toLowerCase().includes(q)
    );
  }, [processed, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "movers":
        // Most active pairs — highest total trade count (buys + sells)
        arr.sort((a, b) => {
          const tradesA = Number(a.et.buyCount) + Number(a.et.sellCount);
          const tradesB = Number(b.et.buyCount) + Number(b.et.sellCount);
          return tradesB - tradesA;
        });
        break;
      case "recent":
        arr.sort((a, b) => Number(b.et.record.createdAt - a.et.record.createdAt));
        break;
      case "mcap":
        arr.sort((a, b) => b.mcap - a.mcap);
        break;
      case "volume":
        arr.sort((a, b) => b.volume - a.volume);
        break;
      case "change": {
        // Sort by 24h data if available, else by all-time proxy
        arr.sort((a, b) => {
          const ca =
            data24h[a.et.record.token]?.priceChange ??
            (INITIAL_PRICE > 0
              ? ((a.price - INITIAL_PRICE) / INITIAL_PRICE) * 100
              : 0);
          const cb =
            data24h[b.et.record.token]?.priceChange ??
            (INITIAL_PRICE > 0
              ? ((b.price - INITIAL_PRICE) / INITIAL_PRICE) * 100
              : 0);
          return cb - ca;
        });
        break;
      }
    }
    return arr;
  }, [filtered, sortBy, data24h]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page & close trade panel on search/sort change
  useEffect(() => {
    setPage(1);
    setExpandedToken(null);
  }, [search, sortBy]);

  useEffect(() => {
    setExpandedToken(null);
  }, [page]);

  // ── Background 24h data fetch for visible page ──
  useEffect(() => {
    if (paginated.length === 0 || fetching24hRef.current) return;

    const run = async () => {
      fetching24hRef.current = true;
      try {
        const results = await Promise.allSettled(
          paginated.map(async (row) => {
            const key = row.et.record.token;
            const d = await compute24hForToken(
              row.et.record.curve,
              row.et.record.graduated
                ? row.et.record.migrationPool
                : undefined,
              row.price
            );
            return { key, d };
          })
        );
        const batch: Record<string, Data24h> = {};
        for (const r of results) {
          if (r.status === "fulfilled") batch[r.value.key] = r.value.d;
        }
        setData24h((prev) => ({ ...prev, ...batch }));
      } finally {
        fetching24hRef.current = false;
      }
    };

    run();
    const interval = setInterval(run, 60000); // refresh every 60s
    return () => clearInterval(interval);
    // Re-run when page content changes (via page, sorted length, or first token on page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, paginated.length, paginated[0]?.et.record.token]);

  // ── Fetch balances for expanded trade row ──
  useEffect(() => {
    if (!expandedToken || !userAddress || !readProvider) {
      setUsdcBalance(0n);
      setTokenBalance(0n);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setBalanceLoading(true);
      try {
        const [usdc, tok] = await Promise.all([
          readProvider.getBalance(userAddress),
          getLaunchToken(expandedToken, readProvider).balanceOf(userAddress),
        ]);
        if (!cancelled) {
          setUsdcBalance(usdc);
          setTokenBalance(tok);
        }
      } catch (err) {
        console.warn("Balance fetch failed:", err);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [expandedToken, userAddress, readProvider, balanceRefreshKey]);

  // ── Debounced quote ──
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    setQuoteResult("");

    if (!tradeAmount || !expandedToken || !readProvider) return;
    const val = parseFloat(tradeAmount);
    if (isNaN(val) || val <= 0) return;

    setQuoting(true);
    quoteTimer.current = setTimeout(async () => {
      try {
        const et = enrichedTokens.find(
          (e) => e.record.token === expandedToken
        );
        if (!et) return;

        const amountWei = ethers.parseEther(tradeAmount);
        const graduated = et.record.graduated;
        const curveAddr = et.record.curve;
        const poolAddr = et.record.migrationPool;

        if (tradeMode === "buy") {
          if (graduated && poolAddr && poolAddr !== ethers.ZeroAddress) {
            const stats = await getPostMigrationPool(
              poolAddr,
              readProvider
            ).getPoolStats();
            const [tokenReserve, usdcReserve, , activeLPSupply] = stats;
            const feeBps = 40n;
            const net = amountWei - (amountWei * feeBps) / 10000n;
            const out = (net * tokenReserve) / (usdcReserve + net);
            setQuoteResult(
              `≈ ${formatNumber(parseFloat(ethers.formatEther(out)), 2)} tokens`
            );
          } else {
            const [tokensOut] = await getBondingCurve(
              curveAddr,
              readProvider
            ).quoteBuy(amountWei);
            setQuoteResult(
              `≈ ${formatNumber(parseFloat(ethers.formatEther(tokensOut)), 2)} tokens`
            );
          }
        } else {
          if (graduated && poolAddr && poolAddr !== ethers.ZeroAddress) {
            const stats = await getPostMigrationPool(
              poolAddr,
              readProvider
            ).getPoolStats();
            const [tokenReserve, usdcReserve, , activeLPSupply] = stats;
            const feeBps = 40n;
            const gross =
              (amountWei * usdcReserve) / (tokenReserve + amountWei);
            const out = gross - (gross * feeBps) / 10000n;
            setQuoteResult(
              `≈ $${formatNumber(parseFloat(ethers.formatEther(out)), 4)} USDC`
            );
          } else {
            const [usdcOut] = await getBondingCurve(
              curveAddr,
              readProvider
            ).quoteSell(amountWei);
            setQuoteResult(
              `≈ $${formatNumber(parseFloat(ethers.formatEther(usdcOut)), 4)} USDC`
            );
          }
        }
      } catch (err) {
        console.warn("Quote failed:", err);
        setQuoteResult("Quote unavailable");
      } finally {
        setQuoting(false);
      }
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeAmount, tradeMode, expandedToken]);

  // ── Preset handler ──
  const handlePreset = useCallback(
    (pct: number) => {
      if (tradeMode === "buy") {
        if (usdcBalance === 0n) return;
        let amt: bigint;
        if (pct === 100) {
          const onePercent = usdcBalance / 100n;
          const minBuf = ethers.parseEther("0.1");
          const reserve = onePercent > minBuf ? onePercent : minBuf;
          amt = usdcBalance > reserve ? usdcBalance - reserve : 0n;
        } else {
          amt = (usdcBalance * BigInt(pct)) / 100n;
        }
        setTradeAmount(ethers.formatEther(amt));
      } else {
        if (tokenBalance === 0n) return;
        // 100% sell: use exact full balance — no rounding
        const amt =
          pct === 100
            ? tokenBalance
            : (tokenBalance * BigInt(pct)) / 100n;
        setTradeAmount(ethers.formatEther(amt));
      }
    },
    [tradeMode, usdcBalance, tokenBalance]
  );

  // ── Execute trade ──
  const executeTrade = useCallback(async () => {
    if (!signer || !userAddress || !expandedToken || !tradeAmount) return;

    const et = enrichedTokens.find((e) => e.record.token === expandedToken);
    if (!et) return;

    setExecuting(true);
    const toastId = toast.loading(
      tradeMode === "buy" ? "Preparing buy..." : "Preparing sell..."
    );

    try {
      const amountWei = ethers.parseEther(tradeAmount);
      if (amountWei === 0n) throw new Error("Amount is zero");

      const graduated = et.record.graduated;
      const curveAddr = et.record.curve;
      const poolAddr = et.record.migrationPool;

      if (tradeMode === "buy") {
        if (graduated && poolAddr && poolAddr !== ethers.ZeroAddress) {
          // Pool buy
          const stats = await getPostMigrationPool(
            poolAddr,
            readProvider
          ).getPoolStats();
          const [tokenReserve, usdcReserve, , activeLPSupply] = stats;
          const feeBps = activeLPSupply > 0n ? 50n : 30n;
          const net = amountWei - (amountWei * feeBps) / 10000n;
          const tokensOut = (net * tokenReserve) / (usdcReserve + net);
          const minOut = (tokensOut * 97n) / 100n; // 3% slippage
          const pool = getPostMigrationPoolWrite(poolAddr, signer);
          toast.loading("Confirm in wallet...", { id: toastId });
          const tx = await pool.swap(minOut, 0n, userAddress, amountWei, {
            value: amountWei,
          });
          toast.loading("Transaction submitted — confirming...", { id: toastId });
          await tx.wait();
        } else {
          // Curve buy
          const [tokensOut] = await getBondingCurve(
            curveAddr,
            readProvider
          ).quoteBuy(amountWei);
          const minOut = (tokensOut * 98n) / 100n; // 2% slippage
          const curveW = getBondingCurveWrite(curveAddr, signer);
          toast.loading("Confirm in wallet...", { id: toastId });
          const tx = await curveW.buy(minOut, userAddress, {
            value: amountWei,
          });
          toast.loading("Transaction submitted — confirming...", { id: toastId });
          await tx.wait();
        }
        toast.success("Buy successful!", { id: toastId });
      } else {
        // Sell — approval first
        const spender =
          graduated && poolAddr !== ethers.ZeroAddress ? poolAddr : curveAddr;
        const tokenRead = getLaunchToken(expandedToken, readProvider);
        const allowance = await tokenRead.allowance(userAddress, spender);
        if (allowance < amountWei) {
          toast.loading("Approve token spending in wallet...", { id: toastId });
          const tokenW = getLaunchTokenWrite(expandedToken, signer);
          const aTx = await tokenW.approve(spender, ethers.MaxUint256);
          toast.loading("Waiting for approval...", { id: toastId });
          await aTx.wait();
        }

        if (graduated && poolAddr && poolAddr !== ethers.ZeroAddress) {
          // Pool sell (output-specified)
          const stats = await getPostMigrationPool(
            poolAddr,
            readProvider
          ).getPoolStats();
          const [tokenReserve, usdcReserve, , activeLPSupply] = stats;
          const feeBps = activeLPSupply > 0n ? 50n : 30n;
          const gross =
            (amountWei * usdcReserve) / (tokenReserve + amountWei);
          const usdcOut = gross - (gross * feeBps) / 10000n;
          const minOut = (usdcOut * 97n) / 100n; // 3% slippage
          const pool = getPostMigrationPoolWrite(poolAddr, signer);
          toast.loading("Confirm sell in wallet...", { id: toastId });
          const tx = await pool.swap(0n, minOut, userAddress, amountWei);
          toast.loading("Transaction submitted — confirming...", { id: toastId });
          await tx.wait();
        } else {
          // Curve sell
          const [usdcOut] = await getBondingCurve(
            curveAddr,
            readProvider
          ).quoteSell(amountWei);
          const minOut = (usdcOut * 98n) / 100n; // 2% slippage
          const curveW = getBondingCurveWrite(curveAddr, signer);
          toast.loading("Confirm sell in wallet...", { id: toastId });
          const tx = await curveW.sell(amountWei, minOut);
          toast.loading("Transaction submitted — confirming...", { id: toastId });
          await tx.wait();
        }
        toast.success("Sell successful!", { id: toastId });
      }

      setTradeAmount("");
      setQuoteResult("");
      setBalanceRefreshKey((k) => k + 1);
      refresh();
    } catch (err: any) {
      console.error("Trade failed:", err);
      const msg = parseTransactionError(err);
      toast.error(msg, { id: toastId, duration: 5000 });
    } finally {
      setExecuting(false);
    }
  }, [
    signer,
    userAddress,
    expandedToken,
    tradeAmount,
    tradeMode,
    readProvider,
    enrichedTokens,
    refresh,
  ]);

  // ── Open / close trade panel ──
  const openTrade = (tokenAddr: string, mode: TradeMode) => {
    setExpandedToken(tokenAddr);
    setTradeMode(mode);
    setTradeAmount("");
    setQuoteResult("");
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <motion.h1
            className="font-display text-3xl md:text-4xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-foreground">EXPLORE </span>
            <span className="text-primary text-glow-purple">MARKETS</span>
          </motion.h1>
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-primary/20 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Sort tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(
            [
              ["movers", "Movers"],
              ["recent", "Most Recent"],
              ["mcap", "Market Cap"],
              ["volume", "Volume"],
              ["change", "24h Change"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-4 py-1.5 rounded-full text-xs font-display transition-colors ${
                sortBy === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-primary/20 text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading / Empty */}
        {loading && enrichedTokens.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-primary mr-2" size={20} />
            <span className="text-muted-foreground font-body text-sm">
              Loading markets...
            </span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground font-body">
              {search ? "No tokens match your search." : "No tokens found."}
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-primary/20 bg-card/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary/15 bg-primary/5">
                    <th className="text-left p-3 font-display text-[10px] text-muted-foreground w-8">
                      #
                    </th>
                    <th className="text-left p-3 font-display text-[10px] text-muted-foreground min-w-[160px]">
                      Token
                    </th>
                    <th className="text-right p-3 font-display text-[10px] text-muted-foreground">
                      Price
                    </th>
                    <th className="text-right p-3 font-display text-[10px] text-muted-foreground">
                      24h
                    </th>
                    <th className="text-right p-3 font-display text-[10px] text-muted-foreground">
                      Market Cap
                    </th>
                    <th className="text-right p-3 font-display text-[10px] text-muted-foreground">
                      Volume
                    </th>
                    <th className="text-right p-3 font-display text-[10px] text-muted-foreground">
                      Holders
                    </th>
                    <th className="text-center p-3 font-display text-[10px] text-muted-foreground min-w-[90px]">
                      Bonding
                    </th>
                    <th className="text-center p-3 font-display text-[10px] text-muted-foreground">
                      Hype
                    </th>
                    <th className="text-right p-3 font-display text-[10px] text-muted-foreground">
                      Age
                    </th>
                    <th className="text-center p-3 font-display text-[10px] text-muted-foreground min-w-[110px]">
                      Trade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row, i) => {
                    const { et, price, mcap, volume, bondingPct, hype, badge } =
                      row;
                    const rec = et.record;
                    const globalIdx = (page - 1) * PAGE_SIZE + i + 1;

                    // 24h data (background fetched) — fallback to all-time
                    const d24 = data24h[rec.token];
                    const change24h =
                      d24 !== undefined
                        ? d24.priceChange
                        : INITIAL_PRICE > 0
                          ? ((price - INITIAL_PRICE) / INITIAL_PRICE) * 100
                          : 0;
                    const vol24h = d24 !== undefined ? d24.volume : volume;
                    const isPositive = change24h >= 0;

                    return (
                        <tr
                          key={rec.token}
                          className="border-b border-primary/10 transition-colors hover:bg-primary/[0.03]"
                        >
                          <td className="p-3 text-muted-foreground font-body text-xs">
                            {globalIdx}
                          </td>

                          {/* Token */}
                          <td className="p-3">
                            <Link
                              to={`/token/${rec.token}`}
                              className="flex items-center gap-2 group"
                            >
                              {rec.imageURI ? (
                                <img
                                  src={rec.imageURI}
                                  alt=""
                                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <span className="font-display text-[10px] text-primary">
                                    {rec.symbol.slice(0, 2)}
                                  </span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-body text-xs text-foreground group-hover:text-primary transition-colors truncate">
                                    {rec.name}
                                  </span>
                                  {badge && (
                                    <span
                                      className={`text-[8px] font-display px-1.5 py-px rounded-full border leading-tight ${badge.color}`}
                                    >
                                      {badge.label}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground font-body">
                                  {rec.symbol}
                                </span>
                              </div>
                            </Link>
                          </td>

                          {/* Price */}
                          <td className="p-3 text-right font-body text-xs text-foreground whitespace-nowrap">
                            {formatPriceNum(price)}
                          </td>

                          {/* 24h Change */}
                          <td
                            className={`p-3 text-right font-body text-xs whitespace-nowrap ${isPositive ? "text-secondary" : "text-destructive"}`}
                          >
                            <span className="inline-flex items-center gap-0.5">
                              {isPositive ? "↑" : "↓"}
                              {Math.abs(change24h) > 999
                                ? formatNumber(Math.abs(change24h), 0) + "%"
                                : Math.abs(change24h).toFixed(1) + "%"}
                            </span>
                          </td>

                          {/* Market Cap */}
                          <td className="p-3 text-right font-body text-xs text-foreground whitespace-nowrap">
                            ${formatNumber(mcap, 0)}
                          </td>

                          {/* Volume */}
                          <td className="p-3 text-right font-body text-xs text-foreground whitespace-nowrap">
                            ${formatNumber(vol24h, 0)}
                          </td>

                          {/* Holders */}
                          <td className="p-3 text-right font-body text-xs text-foreground">
                            {Number(et.holderCount)}
                          </td>

                          {/* Bonding */}
                          <td className="p-3">
                            {rec.graduated ? (
                              <span className="text-[9px] font-display text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                                DEX
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(bondingPct, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground font-body w-8 text-right">
                                  {bondingPct.toFixed(0)}%
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Hype */}
                          <td className="p-3 text-center">
                            <span className="inline-block text-[10px] font-display text-primary bg-primary/15 px-2 py-0.5 rounded-full min-w-[28px]">
                              {hype}
                            </span>
                          </td>

                          {/* Age */}
                          <td className="p-3 text-right text-muted-foreground font-body text-[10px] whitespace-nowrap">
                            {formatAge(Number(rec.createdAt))}
                          </td>

                          {/* Trade buttons */}
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  openTrade(rec.token, "buy");
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-display transition-colors bg-secondary/15 text-secondary hover:bg-secondary/25"
                              >
                                Buy
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  openTrade(rec.token, "sell");
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-display transition-colors bg-destructive/15 text-destructive hover:bg-destructive/25"
                              >
                                Sell
                              </button>
                            </div>
                          </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-card border border-primary/20 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-body text-muted-foreground">
                  Page{" "}
                  <span className="text-foreground font-display">{page}</span>{" "}
                  of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-card border border-primary/20 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Footer */}
            <p className="text-center mt-4 text-[10px] text-muted-foreground font-body">
              {sorted.length} token{sorted.length !== 1 ? "s" : ""} found
            </p>
          </>
        )}
      </div>

      {/* ── Trade Modal ── */}
      <AnimatePresence>
        {expandedToken && (() => {
          const selectedEt = enrichedTokens.find(e => e.record.token === expandedToken);
          if (!selectedEt) return null;
          const rec = selectedEt.record;
          const selectedPrice = rec.graduated && selectedEt.poolSpotPrice > 0n
            ? parseFloat(ethers.formatEther(selectedEt.poolSpotPrice))
            : parseFloat(ethers.formatEther(selectedEt.spotPrice));

          return (
            <motion.div
              key="trade-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setExpandedToken(null)}
            >
              <motion.div
                key="trade-modal"
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-md bg-card border border-primary/20 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between p-4 border-b border-primary/10">
                  <div className="flex items-center gap-3">
                    {rec.imageURI ? (
                      <img src={rec.imageURI} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="font-display text-xs text-primary">{rec.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <div>
                      <div className="font-display text-sm text-foreground">{rec.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-body">{rec.symbol}</span>
                        <span className="text-xs text-foreground font-body">{formatPriceNum(selectedPrice)}</span>
                        {rec.graduated && (
                          <span className="text-[9px] font-display text-accent bg-accent/10 px-1.5 py-px rounded-full">DEX</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedToken(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal body */}
                <div className="p-4 space-y-4">
                  {/* Mode toggle */}
                  <div className="flex gap-0.5 rounded-xl bg-muted p-1">
                    <button
                      onClick={() => { setTradeMode("buy"); setTradeAmount(""); setQuoteResult(""); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-display transition-colors ${
                        tradeMode === "buy"
                          ? "bg-secondary text-secondary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => { setTradeMode("sell"); setTradeAmount(""); setQuoteResult(""); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-display transition-colors ${
                        tradeMode === "sell"
                          ? "bg-destructive text-destructive-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Sell
                    </button>
                  </div>

                  {/* Balance */}
                  <div className="text-xs font-body text-muted-foreground">
                    {!isConnected ? (
                      "Connect wallet to trade"
                    ) : balanceLoading ? (
                      <span className="animate-pulse">Loading balance...</span>
                    ) : tradeMode === "buy" ? (
                      <>Balance: <span className="text-foreground">${formatNumber(parseFloat(ethers.formatEther(usdcBalance)), 2)} USDC</span></>
                    ) : (
                      <>Balance: <span className="text-foreground">{formatNumber(parseFloat(ethers.formatEther(tokenBalance)), 2)} {rec.symbol}</span></>
                    )}
                  </div>

                  {/* Presets */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handlePreset(pct)}
                        disabled={!isConnected}
                        className="flex-1 py-1.5 rounded-lg text-xs font-display bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Amount input */}
                  <div>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={tradeMode === "buy" ? "USDC amount" : "Token amount"}
                      value={tradeAmount}
                      onChange={(e) => {
                        if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setTradeAmount(e.target.value);
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-primary/20 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  {/* Quote */}
                  {(quoting || quoteResult) && (
                    <div className="text-sm font-body text-center">
                      {quoting ? (
                        <span className="text-muted-foreground animate-pulse">Quoting...</span>
                      ) : (
                        <span className="text-foreground">{quoteResult}</span>
                      )}
                    </div>
                  )}

                  {/* Execute */}
                  <button
                    onClick={executeTrade}
                    disabled={!isConnected || !tradeAmount || executing || quoting}
                    className={`w-full py-3 rounded-xl text-sm font-display transition-colors disabled:opacity-30 ${
                      tradeMode === "buy"
                        ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                        : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    }`}
                  >
                    {executing ? (
                      <Loader2 size={16} className="animate-spin mx-auto" />
                    ) : tradeMode === "buy" ? (
                      `Buy ${rec.symbol}`
                    ) : (
                      `Sell ${rec.symbol}`
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default Explore;
