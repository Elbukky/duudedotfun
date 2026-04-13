import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Loader2, Droplets, Plus, Minus, Gift, ExternalLink, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useTokenFactory, type EnrichedToken } from "@/hooks/useTokenFactory";
import { usePostMigrationPool, type PoolStats } from "@/hooks/usePostMigrationPool";
import { useWeb3 } from "@/lib/web3Provider";
import { formatUSDC, formatTokenAmount, getPostMigrationPool, getLaunchToken, formatPriceNum, type TokenRecord } from "@/lib/contracts";
import { shortAddress, addressLink } from "@/lib/arcscan";
import { toast } from "sonner";

// Per-pool state managed within the page
interface PoolDisplayData {
  record: TokenRecord;
  stats: PoolStats | null;
  lpBalance: bigint;
  claimable: bigint;
  loading: boolean;
}

// Standalone pool card component
function PoolCard({
  data,
  onRefresh,
}: {
  data: PoolDisplayData;
  onRefresh: () => void;
}) {
  const { signer, isConnected, address: userAddress, readProvider } = useWeb3();
  const pool = usePostMigrationPool(data.record.migrationPool);

  const [tab, setTab] = useState<"add" | "remove" | "claim">("add");
  const [tokenAmount, setTokenAmount] = useState("");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [lpRemoveAmount, setLpRemoveAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [userUsdcBalance, setUserUsdcBalance] = useState<bigint>(0n);
  const [userTokenBalance, setUserTokenBalance] = useState<bigint>(0n);
  // Track which field was last edited to avoid circular auto-fill
  const [lastEdited, setLastEdited] = useState<"token" | "usdc" | null>(null);

  const { record, stats, lpBalance, claimable } = data;

  // Fetch user balances
  useEffect(() => {
    if (!userAddress) return;
    const fetchBalances = async () => {
      try {
        const bal = await readProvider.getBalance(userAddress);
        setUserUsdcBalance(bal);
      } catch {}
      try {
        const token = getLaunchToken(record.token, readProvider);
        const bal = await token.balanceOf(userAddress);
        setUserTokenBalance(bal);
      } catch {}
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [userAddress, record.token, readProvider]);

  // Resolve logo
  let logo = record.imageURI || "";
  if (!logo) {
    try {
      logo = localStorage.getItem(`token-image-${record.token.toLowerCase()}`) || "";
    } catch {}
  }

  const isImageUrl = (uri: string) => uri.startsWith("data:") || uri.startsWith("http");

  const spotPriceNum = stats ? parseFloat(ethers.formatEther(stats.spotPrice)) : 0;
  const tokenReserveNum = stats ? parseFloat(ethers.formatEther(stats.tokenReserve)) : 0;
  const usdcReserveNum = stats ? parseFloat(ethers.formatEther(stats.usdcReserve)) : 0;
  const lpBalanceNum = parseFloat(ethers.formatEther(lpBalance));
  const claimableNum = parseFloat(ethers.formatEther(claimable));
  const totalLPNum = stats ? parseFloat(ethers.formatEther(stats.totalLPSupply)) : 0;
  const lpSharePct = totalLPNum > 0 ? (lpBalanceNum / totalLPNum) * 100 : 0;

  // Pool ratio: USDC per token
  const poolRatio = tokenReserveNum > 0 ? usdcReserveNum / tokenReserveNum : 0;

  // Format a computed ratio amount without scientific notation
  const formatRatioAmount = (n: number): string => {
    if (n === 0) return "0";
    if (n < 0.000001) return n.toFixed(18);
    if (n < 1) return n.toFixed(8);
    if (n >= 1_000_000) return Math.round(n).toString();
    if (n >= 1) return n.toFixed(4);
    return n.toString();
  };

  // Auto-fill ratio when user enters one amount
  const handleTokenAmountChange = (val: string) => {
    setTokenAmount(val);
    setLastEdited("token");
    if (poolRatio > 0 && val && parseFloat(val) > 0) {
      const usdcNeeded = parseFloat(val) * poolRatio;
      setUsdcAmount(formatRatioAmount(usdcNeeded));
    } else if (!val || parseFloat(val) === 0) {
      setUsdcAmount("");
    }
  };

  const handleUsdcAmountChange = (val: string) => {
    setUsdcAmount(val);
    setLastEdited("usdc");
    if (poolRatio > 0 && val && parseFloat(val) > 0) {
      const tokenNeeded = parseFloat(val) / poolRatio;
      setTokenAmount(formatRatioAmount(tokenNeeded));
    } else if (!val || parseFloat(val) === 0) {
      setTokenAmount("");
    }
  };

  const handleAddLiquidity = async () => {
    if (!isConnected || !tokenAmount || !usdcAmount) return;
    setBusy(true);
    try {
      toast.info(`Adding liquidity to ${record.symbol} pool...`);
      await pool.addLiquidity(tokenAmount, usdcAmount);
      toast.success("Liquidity added successfully!");
      setTokenAmount("");
      setUsdcAmount("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.reason || err.message || "Add liquidity failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!isConnected || !lpRemoveAmount) return;
    setBusy(true);
    try {
      toast.info(`Removing liquidity from ${record.symbol} pool...`);
      await pool.removeLiquidity(lpRemoveAmount);
      toast.success("Liquidity removed successfully!");
      setLpRemoveAmount("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.reason || err.message || "Remove liquidity failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClaimFees = async () => {
    if (!isConnected) return;
    setBusy(true);
    try {
      toast.info(`Claiming LP fees from ${record.symbol} pool...`);
      await pool.claimLPFees();
      toast.success("LP fees claimed!");
      onRefresh();
    } catch (err: any) {
      toast.error(err.reason || err.message || "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const handleMaxLP = () => {
    setLpRemoveAmount(ethers.formatEther(lpBalance));
  };

  return (
    <motion.div
      className="card-cartoon"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {logo && isImageUrl(logo) ? (
          <img src={logo} alt={record.name} className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
            {logo || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/token/${record.token}`} className="font-display text-sm text-foreground hover:text-primary transition-colors truncate">
              {record.name}
            </Link>
            <span className="text-xs text-primary font-body">${record.symbol}</span>
            <span className="text-[9px] font-body text-accent bg-accent/10 px-1.5 py-0.5 rounded">DEX</span>
          </div>
          <p className="text-xs text-muted-foreground font-body">
            Pool: <a href={addressLink(record.migrationPool)} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
              {shortAddress(record.migrationPool)} <ExternalLink size={9} className="inline" />
            </a>
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-sm text-foreground">
            {formatPriceNum(spotPriceNum)}
          </p>
          <p className="text-[10px] text-muted-foreground font-body">spot price</p>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground font-body">Token Reserve</p>
          <p className="font-display text-xs text-foreground">{formatTokenAmount(data.stats?.tokenReserve || 0n)}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground font-body">USDC Reserve</p>
          <p className="font-display text-xs text-foreground">{formatUSDC(data.stats?.usdcReserve || 0n, 2)}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground font-body">Your LP</p>
          <p className="font-display text-xs text-foreground">
            {lpBalanceNum > 0 ? `${lpBalanceNum < 0.01 ? lpBalanceNum.toExponential(2) : lpBalanceNum.toFixed(4)}` : "0"}
          </p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground font-body">LP Share</p>
          <p className="font-display text-xs text-foreground">{lpSharePct.toFixed(2)}%</p>
        </div>
      </div>

      {/* Claimable fees banner */}
      {claimableNum > 0 && (
        <div className="flex items-center justify-between bg-secondary/10 border border-secondary/20 rounded-lg px-3 py-2 mb-4">
          <div className="flex items-center gap-2">
            <Gift size={14} className="text-secondary" />
            <span className="text-xs font-body text-secondary">
              {claimableNum < 0.01 ? claimableNum.toFixed(6) : claimableNum.toFixed(4)} USDC claimable
            </span>
          </div>
          <button
            onClick={handleClaimFees}
            disabled={busy}
            className="text-xs font-display text-secondary-foreground bg-secondary px-3 py-1 rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {busy ? "..." : "Claim"}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border-2 border-primary/20 mb-4">
        <button
          onClick={() => setTab("add")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-body transition-colors ${
            tab === "add" ? "bg-secondary/20 text-secondary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Plus size={12} /> Add
        </button>
        <button
          onClick={() => setTab("remove")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-body transition-colors ${
            tab === "remove" ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Minus size={12} /> Remove
        </button>
      </div>

      {/* Add Liquidity */}
      {tab === "add" && (
        <div className="space-y-3">
          {/* User balances */}
          {isConnected && userAddress && (
            <div className="flex justify-between items-center text-xs font-body bg-muted/30 rounded-lg px-3 py-2 border border-primary/10">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">USDC:</span>
                <span className="text-foreground font-display">{formatUSDC(userUsdcBalance)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{record.symbol}:</span>
                <span className="text-foreground font-display">{formatTokenAmount(userTokenBalance)}</span>
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-body text-muted-foreground">{record.symbol} Amount</label>
              {isConnected && userTokenBalance > 0n && (
                <button
                  onClick={() => handleTokenAmountChange(ethers.formatEther(userTokenBalance))}
                  className="text-[10px] font-body text-primary hover:underline"
                >
                  MAX
                </button>
              )}
            </div>
            <input
              type="number"
              value={tokenAmount}
              onChange={(e) => handleTokenAmountChange(e.target.value)}
              placeholder="0.0"
              className="w-full bg-muted border border-primary/20 rounded-lg px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-body text-muted-foreground">USDC Amount</label>
              {isConnected && userUsdcBalance > ethers.parseEther("0.01") && (
                <button
                  onClick={() => {
                    const maxUsdc = userUsdcBalance - ethers.parseEther("0.01");
                    handleUsdcAmountChange(ethers.formatEther(maxUsdc));
                  }}
                  className="text-[10px] font-body text-primary hover:underline"
                >
                  MAX
                </button>
              )}
            </div>
            <input
              type="number"
              value={usdcAmount}
              onChange={(e) => handleUsdcAmountChange(e.target.value)}
              placeholder="0.0"
              className="w-full bg-muted border border-primary/20 rounded-lg px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-primary/50"
            />
          </div>
          {stats && (
            <p className="text-[10px] text-muted-foreground font-body">
              Pool ratio: 1 {record.symbol} = {spotPriceNum < 0.01 ? spotPriceNum.toFixed(8) : spotPriceNum.toFixed(6)} USDC
              {tokenAmount && usdcAmount && " · amounts auto-calculated"}
            </p>
          )}
          <motion.button
            onClick={handleAddLiquidity}
            disabled={busy || !isConnected || !tokenAmount || !usdcAmount}
            className="w-full btn-arcade py-2.5 text-xs bg-secondary text-secondary-foreground border-secondary disabled:opacity-50"
            whileHover={{ scale: busy ? 1 : 1.02 }}
            whileTap={{ scale: busy ? 1 : 0.98 }}
          >
            {!isConnected ? "Connect Wallet" : busy ? "Adding..." : "Add Liquidity"}
          </motion.button>
        </div>
      )}

      {/* Remove Liquidity */}
      {tab === "remove" && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-body text-muted-foreground">LP Tokens to Remove</label>
              {lpBalance > 0n && (
                <button onClick={handleMaxLP} className="text-[10px] font-body text-primary hover:underline">
                  Max: {lpBalanceNum < 0.01 ? lpBalanceNum.toExponential(2) : lpBalanceNum.toFixed(4)}
                </button>
              )}
            </div>
            <input
              type="number"
              value={lpRemoveAmount}
              onChange={(e) => setLpRemoveAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-muted border border-primary/20 rounded-lg px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-primary/50"
            />
          </div>
          {lpBalance === 0n && (
            <p className="text-xs text-muted-foreground font-body text-center py-2">
              You have no LP tokens in this pool.
            </p>
          )}
          <motion.button
            onClick={handleRemoveLiquidity}
            disabled={busy || !isConnected || !lpRemoveAmount || lpBalance === 0n}
            className="w-full btn-arcade py-2.5 text-xs bg-destructive text-destructive-foreground border-destructive disabled:opacity-50"
            whileHover={{ scale: busy ? 1 : 1.02 }}
            whileTap={{ scale: busy ? 1 : 0.98 }}
          >
            {!isConnected ? "Connect Wallet" : busy ? "Removing..." : "Remove Liquidity"}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

const Liquidity = () => {
  const { enrichedTokens, loading: tokensLoading } = useTokenFactory();
  const { readProvider, address: userAddress, isConnected } = useWeb3();
  const [poolDataMap, setPoolDataMap] = useState<Map<string, PoolDisplayData>>(new Map());
  const [loadingPools, setLoadingPools] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter to only graduated tokens with valid migration pools
  const graduatedTokens = enrichedTokens.filter(
    (e) => e.record.graduated && e.record.migrationPool && e.record.migrationPool !== ethers.ZeroAddress
  );

  // Fetch pool data for all graduated tokens
  const fetchPoolData = useCallback(async () => {
    if (graduatedTokens.length === 0) return;
    setLoadingPools(true);

    const newMap = new Map<string, PoolDisplayData>();

    await Promise.all(
      graduatedTokens.map(async (e) => {
        const poolAddr = e.record.migrationPool;
        try {
          const pool = getPostMigrationPool(poolAddr, readProvider);

          const [statsResult, lpBalance, claimable] = await Promise.all([
            pool.getPoolStats().catch(() => null),
            userAddress ? pool.getLPBalance(userAddress).catch(() => 0n) : Promise.resolve(0n),
            userAddress ? pool.getLPFeeClaimable(userAddress).catch(() => 0n) : Promise.resolve(0n),
          ]);

          const stats: PoolStats | null = statsResult
            ? {
                tokenReserve: statsResult[0],
                usdcReserve: statsResult[1],
                totalLPSupply: statsResult[2],
                activeLPSupply: statsResult[3],
                spotPrice: statsResult[4],
              }
            : null;

          newMap.set(poolAddr, {
            record: e.record,
            stats,
            lpBalance: lpBalance as bigint,
            claimable: claimable as bigint,
            loading: false,
          });
        } catch (err) {
          console.error(`Failed to fetch pool data for ${poolAddr}:`, err);
          newMap.set(poolAddr, {
            record: e.record,
            stats: null,
            lpBalance: 0n,
            claimable: 0n,
            loading: false,
          });
        }
      })
    );

    setPoolDataMap(newMap);
    setLoadingPools(false);
  }, [graduatedTokens.length, readProvider, userAddress]);

  useEffect(() => {
    fetchPoolData();
  }, [fetchPoolData, refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const loading = tokensLoading || loadingPools;

  // Separate pools: ones user has LP in vs others
  const userPools: PoolDisplayData[] = [];
  const otherPools: PoolDisplayData[] = [];
  for (const [, data] of poolDataMap) {
    if (data.lpBalance > 0n || data.claimable > 0n) {
      userPools.push(data);
    } else {
      otherPools.push(data);
    }
  }

  // Total claimable across all pools
  const totalClaimable = [...poolDataMap.values()].reduce(
    (sum, d) => sum + d.claimable,
    0n
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-5xl font-display text-foreground mb-2">
              <Droplets className="inline w-8 h-8 mr-2 text-primary" />
              <span className="text-primary text-glow-purple">LIQUIDITY</span>
            </h1>
            <p className="text-muted-foreground font-body">
              Provide liquidity to graduated tokens and earn LP fees.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <span className="badge-sticker bg-secondary/20 text-secondary border-secondary/40 text-xs">
                {graduatedTokens.length} graduated pool{graduatedTokens.length !== 1 ? "s" : ""}
              </span>
              {totalClaimable > 0n && (
                <span className="badge-sticker bg-accent/20 text-accent border-accent/40 text-xs">
                  {parseFloat(ethers.formatEther(totalClaimable)).toFixed(4)} USDC claimable
                </span>
              )}
            </div>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : graduatedTokens.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl font-display text-muted-foreground mb-4">
                No graduated tokens yet
              </p>
              <p className="text-muted-foreground font-body mb-6">
                Tokens need to reach 5,000 USDC in bonding to graduate to the DEX pool.
              </p>
              <Link to="/" className="text-primary font-body hover:underline">
                Browse tokens
              </Link>
            </div>
          ) : (
            <>
              {/* Your Positions */}
              {userPools.length > 0 && (
                <div className="mb-8">
                  <h2 className="font-display text-lg text-foreground mb-4">
                    YOUR <span className="text-secondary">POSITIONS</span>
                  </h2>
                  <div className="space-y-4">
                    {userPools.map((data) => (
                      <PoolCard
                        key={data.record.migrationPool}
                        data={data}
                        onRefresh={handleRefresh}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Pools */}
              <div>
                <h2 className="font-display text-lg text-foreground mb-4">
                  {userPools.length > 0 ? "OTHER " : "ALL "}
                  <span className="text-primary">POOLS</span>
                </h2>
                {otherPools.length === 0 && userPools.length > 0 ? (
                  <p className="text-sm text-muted-foreground font-body text-center py-8">
                    You have positions in all available pools.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(userPools.length > 0 ? otherPools : [...poolDataMap.values()]).map(
                      (data) => (
                        <PoolCard
                          key={data.record.migrationPool}
                          data={data}
                          onRefresh={handleRefresh}
                        />
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Fee info */}
              <motion.div
                className="card-cartoon mt-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="font-display text-sm text-foreground mb-2">HOW FEES WORK</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-body text-muted-foreground">
                  <div>
                    <p className="text-foreground font-display text-base mb-1">0.40%</p>
                    <p>Total swap fee (always fixed)</p>
                  </div>
                  <div>
                    <p className="text-foreground font-display text-base mb-1">0.15%</p>
                    <p>Goes to LP providers (you!)</p>
                  </div>
                  <div>
                    <p className="text-foreground font-display text-base mb-1">0.25%</p>
                    <p>Split between protocol (0.20%) and creator (0.05%)</p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Liquidity;
