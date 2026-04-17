import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ArrowLeft, ExternalLink, Users, BarChart3, Clock, Copy, Check, Droplets } from "lucide-react";
import Navbar from "@/components/Navbar";
import HypeScoreWidget from "@/components/HypeScoreWidget";
import MissionCard from "@/components/MissionCard";
import BuySellPanel from "@/components/BuySellPanel";
import ActivityFeed from "@/components/ActivityFeed";
import BondingProgressBar from "@/components/BondingProgressBar";
import ChatBox from "@/components/ChatBox";
import CandlestickChart from "@/components/CandlestickChart";
import StatusBadge from "@/components/StatusBadge";
import AuraWrapper from "@/components/AuraWrapper";
import { useWeb3 } from "@/lib/web3Provider";
import { useProfiles } from "@/lib/profileProvider";
import { useBondingCurve } from "@/hooks/useBondingCurve";
import { usePostMigrationPool, type PoolStats } from "@/hooks/usePostMigrationPool";
import {
  getTokenFactory,
  formatUSDC,
  formatTokenAmount,
  formatPrice,
  formatNumber,
  computeScore,
  type TokenRecord,
  type ArenaMetrics,
} from "@/lib/contracts";
import { shortAddress, addressLink, tokenLink } from "@/lib/arcscan";
import { fetchTokenHolders } from "@/lib/arcscan";
import type { Token, Mission } from "@/lib/mockData";

const TokenDetail = () => {
  const { address } = useParams<{ address: string }>();
  const { readProvider } = useWeb3();
  const { getDisplayName, fetchProfile, getProfile } = useProfiles();

  const [record, setRecord] = useState<TokenRecord | null>(null);
  const [curveAddress, setCurveAddress] = useState<string | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // On-chain state
  const [spotPrice, setSpotPrice] = useState<bigint>(0n);
  const [realUSDCRaised, setRealUSDCRaised] = useState<bigint>(0n);
  const [graduated, setGraduated] = useState(false);
  const [arenaMetrics, setArenaMetrics] = useState<ArenaMetrics | null>(null);
  const [postMigrationVolume, setPostMigrationVolume] = useState(0); // USDC volume from DEX swaps
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);

  // Top holders
  const [topHolders, setTopHolders] = useState<{ address: string; balance: string; percentage: number; label: string }[]>([]);

  // Hooks (safe to call with null - they handle it internally)
  const curve = useBondingCurve(curveAddress);
  const pool = usePostMigrationPool(poolAddress);

  // Fetch token record
  useEffect(() => {
    if (!address) return;

    const fetchRecord = async () => {
      setLoading(true);
      try {
        const factory = getTokenFactory(readProvider);
        const r = await factory.getTokenRecord(address);
        if (r.token === ethers.ZeroAddress) {
          setNotFound(true);
          return;
        }
        // Convert the contract result to our interface
        const tokenRecord: TokenRecord = {
          token: r.token,
          curve: r.curve,
          vestingVault: r.vestingVault,
          creator: r.creator,
          referrer: r.referrer,
          name: r.name,
          symbol: r.symbol,
          description: r.description,
          imageURI: r.imageURI,
          links: {
            website: r.links?.website || r.links?.[0] || "",
            twitter: r.links?.twitter || r.links?.[1] || "",
            telegram: r.links?.telegram || r.links?.[2] || "",
            discord: r.links?.discord || r.links?.[3] || "",
            extra: r.links?.extra || r.links?.[4] || "",
          },
          createdAt: r.createdAt,
          graduated: r.graduated,
          migrationPool: r.migrationPool,
        };
        setRecord(tokenRecord);
        setCurveAddress(tokenRecord.curve);
        setGraduated(tokenRecord.graduated);
        if (
          tokenRecord.graduated &&
          tokenRecord.migrationPool !== ethers.ZeroAddress
        ) {
          setPoolAddress(tokenRecord.migrationPool);
        }
      } catch (err) {
        console.error("Failed to fetch token record:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [address, readProvider]);

  // Fetch creator profile for display name
  useEffect(() => {
    if (record?.creator) {
      fetchProfile(record.creator);
    }
  }, [record?.creator, fetchProfile]);

  // Fetch curve state and metrics
  const refreshData = useCallback(async () => {
    if (!curveAddress) return;
    try {
      const state = await curve.getCurveState();
      if (state) {
        // Only update spotPrice from bonding curve if NOT graduated
        // (pool price effect below handles graduated tokens)
        if (!state.graduated) {
          setSpotPrice(state.spotPrice);
        }
        setRealUSDCRaised(state.realUSDCRaised);
        setGraduated(state.graduated);
      }
    } catch {}
    try {
      const metrics = await curve.getArenaMetrics();
      setArenaMetrics(metrics);
    } catch {}
  }, [curveAddress, curve]);

  useEffect(() => {
    if (curveAddress) {
      refreshData();
      const interval = setInterval(refreshData, 10000);
      return () => clearInterval(interval);
    }
  }, [curveAddress, refreshData]);

  // Separate effect for pool price + post-migration volume — triggers when poolAddress is set
  useEffect(() => {
    if (!poolAddress || poolAddress === ethers.ZeroAddress) return;

    const fetchPoolData = async () => {
      // Fetch pool spot price + pool stats
      try {
        const stats = await pool.getPoolStats();
        if (stats) {
          setPoolStats(stats);
          if (stats.spotPrice > 0n) setSpotPrice(stats.spotPrice);
        }
      } catch {
        // Fallback: try just spotPrice
        try {
          const poolPrice = await pool.getSpotPrice();
          if (poolPrice > 0n) setSpotPrice(poolPrice);
        } catch {}
      }

      // Fetch PostMigrationPool Swap events for volume
      try {
        const ARCSCAN_BASE = "https://testnet.arcscan.app/api/v2";
        const SWAP_TOPIC = ethers.id("Swap(address,address,uint256,uint256,uint256,uint256)").toLowerCase();
        const res = await fetch(`${ARCSCAN_BASE}/addresses/${poolAddress}/logs`);
        if (res.ok) {
          const data = await res.json();
          const logs = data.items || [];
          let poolVol = 0;
          for (const log of logs) {
            if (!log.topics || !log.topics[0]) continue;
            if (log.topics[0].toLowerCase() !== SWAP_TOPIC) continue;
            try {
              const iface = new ethers.Interface([
                "event Swap(address indexed sender, address indexed to, uint256 tokenIn, uint256 usdcIn, uint256 tokenOut, uint256 usdcOut)",
              ]);
              const topics = log.topics.filter((t: string | null) => t != null);
              const parsed = iface.parseLog({ topics, data: log.data });
              if (parsed) {
                const usdcIn = parseFloat(ethers.formatEther(parsed.args.usdcIn));
                const usdcOut = parseFloat(ethers.formatEther(parsed.args.usdcOut));
                poolVol += usdcIn > 0 ? usdcIn : usdcOut;
              }
            } catch {}
          }
          setPostMigrationVolume(poolVol);
        }
      } catch {}
    };

    fetchPoolData();
    const interval = setInterval(fetchPoolData, 10000);
    return () => clearInterval(interval);
  }, [poolAddress, pool]);

  // Fetch top holders from Arcscan
  useEffect(() => {
    if (!address || !record) return;
    const fetchHolders = async () => {
      try {
        const raw = await fetchTokenHolders(address);
        const TOTAL_SUPPLY = 100_000_000_000; // 100B tokens
        // Build known-address label map
        const knownLabels: Record<string, string> = {};
        knownLabels[record.creator.toLowerCase()] = "DEV";
        if (record.curve) knownLabels[record.curve.toLowerCase()] = "CURVE";
        if (record.vestingVault && record.vestingVault !== ethers.ZeroAddress)
          knownLabels[record.vestingVault.toLowerCase()] = "VESTING";
        if (record.migrationPool && record.migrationPool !== ethers.ZeroAddress)
          knownLabels[record.migrationPool.toLowerCase()] = "POOL";

        const parsed = raw.slice(0, 10).map((h: any) => {
          const addr = h.address?.hash || h.address || "";
          // Arcscan returns value as string in smallest unit (18 decimals)
          const rawVal = h.value || "0";
          const bal = parseFloat(ethers.formatEther(rawVal));
          const label = knownLabels[addr.toLowerCase()] || "";
          return {
            address: addr,
            balance: bal >= 1_000_000_000
              ? `${(bal / 1_000_000_000).toFixed(2)}B`
              : bal >= 1_000_000
                ? `${(bal / 1_000_000).toFixed(2)}M`
                : bal >= 1_000
                  ? `${(bal / 1_000).toFixed(2)}K`
                  : bal.toFixed(2),
            percentage: (bal / TOTAL_SUPPLY) * 100,
            label,
          };
        });
        setTopHolders(parsed);
      } catch (err) {
        console.error("Failed to fetch holders:", err);
      }
    };
    fetchHolders();
    const interval = setInterval(fetchHolders, 30000);
    return () => clearInterval(interval);
  }, [address, record]);

  // Derived display values
  const price = parseFloat(ethers.formatEther(spotPrice));
  const raised = parseFloat(ethers.formatEther(realUSDCRaised));
  const holders = arenaMetrics ? Number(arenaMetrics.holderCount) : 0;
  const bondingBps = arenaMetrics ? Number(arenaMetrics.percentCompleteBps) : 0;
  const bondingPct = bondingBps / 100;
  const uniqueBuyers = arenaMetrics ? Number(arenaMetrics.uniqueBuyerCount) : 0;
  const buyVol = arenaMetrics
    ? parseFloat(ethers.formatEther(arenaMetrics.totalBuyVolume))
    : 0;
  const sellVol = arenaMetrics
    ? parseFloat(ethers.formatEther(arenaMetrics.totalSellVolume))
    : 0;
  const totalVol = buyVol + sellVol + postMigrationVolume;

  // Hype score — unified formula (same as arena)
  const hypeScore = arenaMetrics
    ? computeScore(arenaMetrics)
    : 0;

  // Status
  let status: Token["status"] = "new";
  if (graduated) status = "graduated";
  else if (bondingPct >= 80) status = "mooning";
  else if (bondingPct >= 40) status = "hot";
  else if (buyVol > 10) status = "fighting";

  // Launched time ago
  const launchedAt = record
    ? (() => {
        const diffMin = Math.floor(
          (Date.now() / 1000 - Number(record.createdAt)) / 60
        );
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffH = Math.floor(diffMin / 60);
        return diffH >= 24
          ? `${Math.floor(diffH / 24)}d ago`
          : `${diffH}h ago`;
      })()
    : "";

  // Resolve logo: on-chain imageURI > localStorage fallback > "?"
  const resolvedLogo = (() => {
    if (record?.imageURI) return record.imageURI;
    if (address) {
      try {
        const stored = localStorage.getItem(`token-image-${address.toLowerCase()}`);
        if (stored) return stored;
      } catch {}
    }
    return "?";
  })();

  // Build a Token-compatible object for AuraWrapper/StatusBadge
  const displayToken: Token = {
    id: address || "",
    name: record?.name || "",
    ticker: record?.symbol || "",
    logo: resolvedLogo,
    price,
    priceChange24h: 0,
    marketCap: price * 100_000_000_000,
    volume24h: totalVol,
    holders,
    hypeScore,
    bondingProgress: bondingPct,
    category: record?.links?.extra || "Degen",
    creatorId: record?.creator || "",
    creatorName: record ? getDisplayName(record.creator) : "",
    lore: record?.description || "",
    launchedAt,
    arenaRank: 0,
    status,
    curveAddress: curveAddress || undefined,
  };

  // Missions with real progress
  const missions: Mission[] = record
    ? [
        {
          id: "1",
          title: "First Blood",
          description: "Reach 25 holders",
          progress: holders,
          target: 25,
          completed: holders >= 25,
          reward: "Bronze Badge",
          icon: "",
        },
        {
          id: "2",
          title: "Century Club",
          description: "Hit 100 buys",
          progress: arenaMetrics ? Number(arenaMetrics.buyCount) : 0,
          target: 100,
          completed: arenaMetrics ? Number(arenaMetrics.buyCount) >= 100 : false,
          reward: "Silver Badge",
          icon: "",
        },
        {
          id: "3",
          title: "Survivor",
          description: "Survive 24 hours",
          progress: Math.min(
            24,
            Math.floor(
              (Date.now() / 1000 - Number(record.createdAt)) / 3600
            )
          ),
          target: 24,
          completed:
            Date.now() / 1000 - Number(record.createdAt) >= 86400,
          reward: "Shield Badge",
          icon: "",
        },
        {
          id: "4",
          title: "Volume Monster",
          description: "Reach $50K volume",
          progress: Math.floor(totalVol),
          target: 50000,
          completed: totalVol >= 50000,
          reward: "Diamond Badge",
          icon: "",
        },
        {
          id: "5",
          title: "Community Power",
          description: "Get 500 holders",
          progress: holders,
          target: 500,
          completed: holders >= 500,
          reward: "Crown Badge",
          icon: "",
        },
      ]
    : [];

  const isImageUrl = (uri: string) =>
    uri.startsWith("data:") || uri.startsWith("http");

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Social links from record
  const socialLinks = record?.links
    ? [
        { label: "Website", url: record.links.website },
        { label: "Twitter", url: record.links.twitter },
        { label: "Telegram", url: record.links.telegram },
        { label: "Discord", url: record.links.discord },
      ].filter((l) => l.url && l.url.length > 0)
    : [];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 px-4">
          <div className="container max-w-6xl mx-auto text-center">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <p className="font-display text-xl text-muted-foreground">
                Loading token data...
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (notFound || !record) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 px-4">
          <div className="container max-w-6xl mx-auto text-center">
            <p className="font-display text-2xl text-foreground mb-4">
              Token Not Found
            </p>
            <p className="text-muted-foreground font-body mb-6">
              No token exists at this address.
            </p>
            <Link
              to="/"
              className="text-primary font-body hover:underline"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </Link>

          {/* Header */}
          <AuraWrapper token={displayToken} rank={displayToken.arenaRank || undefined} enhanced>
            <motion.div
              className="card-cartoon mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                {isImageUrl(resolvedLogo) ? (
                  <motion.img
                    src={resolvedLogo}
                    alt={record.name}
                    className="w-16 h-16 rounded-xl object-cover"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                ) : (
                  <motion.span
                    className="text-6xl"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    {resolvedLogo}
                  </motion.span>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="font-display text-2xl md:text-3xl text-foreground">
                      {record.name}
                    </h1>
                    <span className="font-display text-lg text-primary">
                      ${record.symbol}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  <p className="text-sm text-muted-foreground font-body mt-1">
                    {record.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Link
                      to={(() => {
                        const profile = getProfile(record.creator);
                        return profile?.username ? `/u/${profile.username}` : `/creator/${record.creator}`;
                      })()}
                      className="text-xs text-primary font-body hover:underline"
                    >
                      by {getDisplayName(record.creator)}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      · {launchedAt}
                    </span>
                    <button
                      onClick={copyAddress}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? (
                        <Check size={10} />
                      ) : (
                        <Copy size={10} />
                      )}
                      {shortAddress(address || "")}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl text-foreground">
                    {formatPrice(spotPrice)}
                  </p>
                  <p className="text-sm font-body text-muted-foreground">
                    MCap: ${price > 0 ? formatNumber(price * 100_000_000_000) : "0"}
                  </p>
                </div>
              </div>
            </motion.div>
          </AuraWrapper>

          {/* ── MOBILE: Trade panel first (visible only on mobile) ── */}
          <div className="lg:hidden mb-6">
            <BuySellPanel
              curveAddress={curveAddress}
              tokenAddress={address || null}
              tokenSymbol={record.symbol}
              graduated={graduated}
              poolAddress={poolAddress}
            />
          </div>

          {/* ── Main 2-column grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT COLUMN (2/3): Chart, Activity, Chat ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    icon: <BarChart3 size={14} />,
                    label: "Volume",
                    value: `$${formatNumber(totalVol)}`,
                  },
                  {
                    icon: <BarChart3 size={14} />,
                    label: "USDC Raised",
                    value: `$${formatNumber(raised)}`,
                  },
                  {
                    icon: <Users size={14} />,
                    label: "Holders",
                    value: holders.toLocaleString(),
                  },
                  {
                    icon: <Clock size={14} />,
                    label: "Unique Buyers",
                    value: uniqueBuyers.toLocaleString(),
                  },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    className="card-cartoon text-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      {s.icon}
                      <span className="text-xs font-body">{s.label}</span>
                    </div>
                    <p className="font-display text-lg text-foreground">
                      {s.value}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Chart */}
              <CandlestickChart
                curveAddress={curveAddress}
                poolAddress={poolAddress}
                currentPrice={price}
                graduated={graduated}
              />

              {/* Activity Feed */}
              <ActivityFeed
                curveAddress={curveAddress}
                poolAddress={poolAddress}
                tokenSymbol={record.symbol}
              />

              {/* Chat */}
              <ChatBox
                title={`${record.symbol} CHAT`}
                mode="token"
                tokenAddress={address}
              />

              {/* ── Secondary content: Arena, Missions, HypeScore (below chat) ── */}
              <HypeScoreWidget score={hypeScore} />

              {arenaMetrics && (
                <div className="card-cartoon">
                  <h3 className="font-display text-sm text-foreground mb-3">
                    ARENA STATUS
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="font-display text-lg text-foreground">
                        {Number(arenaMetrics.buyCount)}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        Buys
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-lg text-foreground">
                        {Number(arenaMetrics.sellCount)}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        Sells
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-lg text-foreground">
                        {Number(arenaMetrics.retainedBuyers)}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        Retained
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-body">
                      Buy Pressure
                    </span>
                    <span className="text-xs font-display text-secondary">
                      {(Number(arenaMetrics.buyPressureBps) / 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {missions.length > 0 && (
                <div>
                  <h3 className="font-display text-sm text-foreground mb-3">
                    MEME MISSIONS
                  </h3>
                  <div className="space-y-3">
                    {missions.map((m, i) => (
                      <MissionCard key={m.id} mission={m} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (1/3): Trade (sticky), Bonding, Info, Holders ── */}
            <div className="space-y-6">

              {/* Trade panel — desktop only (sticky), hidden on mobile (shown above) */}
              <div className="hidden lg:block lg:sticky lg:top-24">
                <div className="space-y-6">
                  <BuySellPanel
                    curveAddress={curveAddress}
                    tokenAddress={address || null}
                    tokenSymbol={record.symbol}
                    graduated={graduated}
                    poolAddress={poolAddress}
                  />

                  {/* Bonding curve progress */}
                  <motion.div
                    className="card-cartoon"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-body text-muted-foreground">
                        {graduated ? "Graduated to DEX" : "Bonding Curve Progress"}
                      </span>
                      <span className="text-xs font-display text-primary">
                        {graduated
                          ? "100%"
                          : `${bondingPct.toFixed(1)}%`}
                      </span>
                    </div>
                    <BondingProgressBar
                      progress={bondingPct}
                      graduated={graduated}
                      barHeight="h-5"
                      mascotSize={58}
                      showGraduationAnim
                    />
                    <div className="flex justify-between mt-2">
                      <p className="text-xs text-muted-foreground font-body">
                        {graduated
                          ? "This token has graduated to the DEX pool."
                          : bondingPct >= 80
                            ? "Almost graduated!"
                            : `${raised.toFixed(2)} / 5,000 USDC`}
                      </p>
                      <a
                        href={tokenLink(address || "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary font-body hover:underline flex items-center gap-1"
                      >
                        Explorer <ExternalLink size={10} />
                      </a>
                    </div>
                  </motion.div>

                  {/* DEX Liquidity Info — shown when graduated */}
                  {graduated && poolStats && (
                    <div className="card-cartoon">
                      <div className="flex items-center gap-2 mb-3">
                        <Droplets size={14} className="text-primary" />
                        <h3 className="font-display text-sm text-foreground">
                          DEX LIQUIDITY
                        </h3>
                        <Link
                          to="/liquidity"
                          className="ml-auto text-[10px] font-body text-primary hover:underline flex items-center gap-1"
                        >
                          Manage <ExternalLink size={9} />
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground font-body">Token Reserve</p>
                          <p className="font-display text-sm text-foreground">
                            {formatTokenAmount(poolStats.tokenReserve)}
                          </p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground font-body">USDC Reserve</p>
                          <p className="font-display text-sm text-foreground">
                            {formatUSDC(poolStats.usdcReserve, 2)}
                          </p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground font-body">LP Supply</p>
                          <p className="font-display text-sm text-foreground">
                            {parseFloat(ethers.formatEther(poolStats.totalLPSupply)) < 0.01
                              ? parseFloat(ethers.formatEther(poolStats.totalLPSupply)).toExponential(2)
                              : formatNumber(parseFloat(ethers.formatEther(poolStats.totalLPSupply)))}
                          </p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground font-body">Spot Price</p>
                          <p className="font-display text-sm text-foreground">
                            {formatPrice(poolStats.spotPrice)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs font-body">
                        <span className="text-muted-foreground">
                          Fee: 0.40% (DEX)
                        </span>
                        <span className="text-muted-foreground">
                          DEX Vol: ${formatNumber(postMigrationVolume)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Top Holders */}
                  {topHolders.length > 0 && (
                    <div className="card-cartoon">
                      <h3 className="font-display text-xs text-muted-foreground mb-3">
                        <Users size={12} className="inline mr-1" />
                        TOP HOLDERS
                      </h3>
                      <div className="space-y-2">
                        {topHolders.map((h, i) => (
                          <div key={h.address} className="flex items-center justify-between text-xs font-body">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                              <a
                                href={addressLink(h.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:text-primary transition-colors truncate"
                              >
                                {shortAddress(h.address)}
                              </a>
                              {h.label && (
                                <span className={`text-[9px] font-body px-1 py-0.5 rounded shrink-0 ${
                                  h.label === "DEV" ? "text-accent bg-accent/10"
                                    : h.label === "POOL" ? "text-primary bg-primary/10"
                                    : h.label === "CURVE" ? "text-secondary bg-secondary/10"
                                    : "text-muted-foreground bg-muted/30"
                                }`}>
                                  {h.label}
                                </span>
                              )}
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="text-foreground">{h.balance}</span>
                              <span className="text-muted-foreground ml-1">
                                ({h.percentage < 0.01 ? "<0.01" : h.percentage.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <a
                        href={tokenLink(address || "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block text-center text-[10px] font-body text-primary hover:underline flex items-center justify-center gap-1"
                      >
                        View all on Explorer <ExternalLink size={9} />
                      </a>
                    </div>
                  )}

                  {/* Contract Addresses */}
                  <div className="card-cartoon">
                    <h3 className="font-display text-xs text-muted-foreground mb-3">
                      CONTRACTS
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-body">
                        <span className="text-muted-foreground">Token</span>
                        <a
                          href={addressLink(record.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {shortAddress(record.token)}{" "}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="flex items-center justify-between text-xs font-body">
                        <span className="text-muted-foreground">Curve</span>
                        <a
                          href={addressLink(record.curve)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {shortAddress(record.curve)}{" "}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                      {graduated && record.migrationPool !== ethers.ZeroAddress && (
                        <div className="flex items-center justify-between text-xs font-body">
                          <span className="text-muted-foreground">DEX Pool</span>
                          <a
                            href={addressLink(record.migrationPool)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {shortAddress(record.migrationPool)}{" "}
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs font-body">
                        <span className="text-muted-foreground">Creator</span>
                        <Link
                          to={(() => {
                            const profile = getProfile(record.creator);
                            return profile?.username ? `/u/${profile.username}` : `/creator/${record.creator}`;
                          })()}
                          className="text-primary hover:underline"
                        >
                          {getDisplayName(record.creator)}
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Social Links */}
                  {socialLinks.length > 0 && (
                    <div className="card-cartoon">
                      <h3 className="font-display text-xs text-muted-foreground mb-3">
                        LINKS
                      </h3>
                      <div className="space-y-2">
                        {socialLinks.map((l) => (
                          <a
                            key={l.label}
                            href={
                              l.url.startsWith("http")
                                ? l.url
                                : `https://${l.url}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between text-xs font-body hover:bg-muted/50 rounded-lg p-1.5 transition-colors"
                          >
                            <span className="text-foreground">{l.label}</span>
                            <ExternalLink
                              size={12}
                              className="text-muted-foreground"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Token Info */}
                  <div className="card-cartoon">
                    <h3 className="font-display text-xs text-muted-foreground mb-3">
                      TOKEN INFO
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-body">
                        <span className="text-muted-foreground">Supply</span>
                        <span className="text-foreground">100B</span>
                      </div>
                      <div className="flex justify-between text-xs font-body">
                        <span className="text-muted-foreground">Grad. Target</span>
                        <span className="text-foreground">5,000 USDC</span>
                      </div>
                      <div className="flex justify-between text-xs font-body">
                        <span className="text-muted-foreground">Fee</span>
                        <span className="text-foreground">
                          {graduated ? "0.40% (DEX)" : "0.60% (Bonding)"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-body">
                        <span className="text-muted-foreground">Status</span>
                        <StatusBadge status={status} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── MOBILE sidebar content (not sticky, after chat) ── */}
              <div className="lg:hidden space-y-6">

                {/* Bonding curve progress */}
                <motion.div
                  className="card-cartoon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-body text-muted-foreground">
                      {graduated ? "Graduated to DEX" : "Bonding Curve Progress"}
                    </span>
                    <span className="text-xs font-display text-primary">
                      {graduated
                        ? "100%"
                        : `${bondingPct.toFixed(1)}%`}
                    </span>
                  </div>
                  <BondingProgressBar
                    progress={bondingPct}
                    graduated={graduated}
                    barHeight="h-5"
                    mascotSize={58}
                    showGraduationAnim
                  />
                  <div className="flex justify-between mt-2">
                    <p className="text-xs text-muted-foreground font-body">
                      {graduated
                        ? "Graduated to the DEX pool."
                        : bondingPct >= 80
                          ? "Almost graduated!"
                          : `${raised.toFixed(2)} / 5,000 USDC`}
                    </p>
                    <a
                      href={tokenLink(address || "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary font-body hover:underline flex items-center gap-1"
                    >
                      Explorer <ExternalLink size={10} />
                    </a>
                  </div>
                </motion.div>

                {/* DEX Liquidity Info */}
                {graduated && poolStats && (
                  <div className="card-cartoon">
                    <div className="flex items-center gap-2 mb-3">
                      <Droplets size={14} className="text-primary" />
                      <h3 className="font-display text-sm text-foreground">
                        DEX LIQUIDITY
                      </h3>
                      <Link
                        to="/liquidity"
                        className="ml-auto text-[10px] font-body text-primary hover:underline flex items-center gap-1"
                      >
                        Manage <ExternalLink size={9} />
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground font-body">Token Reserve</p>
                        <p className="font-display text-sm text-foreground">
                          {formatTokenAmount(poolStats.tokenReserve)}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground font-body">USDC Reserve</p>
                        <p className="font-display text-sm text-foreground">
                          {formatUSDC(poolStats.usdcReserve, 2)}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground font-body">LP Supply</p>
                        <p className="font-display text-sm text-foreground">
                          {parseFloat(ethers.formatEther(poolStats.totalLPSupply)) < 0.01
                            ? parseFloat(ethers.formatEther(poolStats.totalLPSupply)).toExponential(2)
                            : formatNumber(parseFloat(ethers.formatEther(poolStats.totalLPSupply)))}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground font-body">Spot Price</p>
                        <p className="font-display text-sm text-foreground">
                          {formatPrice(poolStats.spotPrice)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">
                        Fee: 0.40% (DEX)
                      </span>
                      <span className="text-muted-foreground">
                        DEX Vol: ${formatNumber(postMigrationVolume)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Top Holders */}
                {topHolders.length > 0 && (
                  <div className="card-cartoon">
                    <h3 className="font-display text-xs text-muted-foreground mb-3">
                      <Users size={12} className="inline mr-1" />
                      TOP HOLDERS
                    </h3>
                    <div className="space-y-2">
                      {topHolders.map((h, i) => (
                        <div key={h.address} className="flex items-center justify-between text-xs font-body">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                            <a
                              href={addressLink(h.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground hover:text-primary transition-colors truncate"
                            >
                              {shortAddress(h.address)}
                            </a>
                            {h.label && (
                              <span className={`text-[9px] font-body px-1 py-0.5 rounded shrink-0 ${
                                h.label === "DEV" ? "text-accent bg-accent/10"
                                  : h.label === "POOL" ? "text-primary bg-primary/10"
                                  : h.label === "CURVE" ? "text-secondary bg-secondary/10"
                                  : "text-muted-foreground bg-muted/30"
                              }`}>
                                {h.label}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="text-foreground">{h.balance}</span>
                            <span className="text-muted-foreground ml-1">
                              ({h.percentage < 0.01 ? "<0.01" : h.percentage.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <a
                      href={tokenLink(address || "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-center text-[10px] font-body text-primary hover:underline flex items-center justify-center gap-1"
                    >
                      View all on Explorer <ExternalLink size={9} />
                    </a>
                  </div>
                )}

                {/* Contract Addresses */}
                <div className="card-cartoon">
                  <h3 className="font-display text-xs text-muted-foreground mb-3">
                    CONTRACTS
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">Token</span>
                      <a
                        href={addressLink(record.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {shortAddress(record.token)}{" "}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">Curve</span>
                      <a
                        href={addressLink(record.curve)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {shortAddress(record.curve)}{" "}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    {graduated && record.migrationPool !== ethers.ZeroAddress && (
                      <div className="flex items-center justify-between text-xs font-body">
                        <span className="text-muted-foreground">DEX Pool</span>
                        <a
                          href={addressLink(record.migrationPool)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {shortAddress(record.migrationPool)}{" "}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-muted-foreground">Creator</span>
                      <Link
                        to={(() => {
                          const profile = getProfile(record.creator);
                          return profile?.username ? `/u/${profile.username}` : `/creator/${record.creator}`;
                        })()}
                        className="text-primary hover:underline"
                      >
                        {getDisplayName(record.creator)}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                {socialLinks.length > 0 && (
                  <div className="card-cartoon">
                    <h3 className="font-display text-xs text-muted-foreground mb-3">
                      LINKS
                    </h3>
                    <div className="space-y-2">
                      {socialLinks.map((l) => (
                        <a
                          key={l.label}
                          href={
                            l.url.startsWith("http")
                              ? l.url
                              : `https://${l.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs font-body hover:bg-muted/50 rounded-lg p-1.5 transition-colors"
                        >
                          <span className="text-foreground">{l.label}</span>
                          <ExternalLink
                            size={12}
                            className="text-muted-foreground"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Token Info */}
                <div className="card-cartoon">
                  <h3 className="font-display text-xs text-muted-foreground mb-3">
                    TOKEN INFO
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Supply</span>
                      <span className="text-foreground">100B</span>
                    </div>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Grad. Target</span>
                      <span className="text-foreground">2,500 USDC</span>
                    </div>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="text-foreground">
                        {graduated ? "0.5% (DEX)" : "0.3% (Protocol)"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={status} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenDetail;
