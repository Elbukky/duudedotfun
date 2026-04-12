import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ArrowLeft, ExternalLink, Users, BarChart3, Clock, Copy, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import HypeScoreWidget from "@/components/HypeScoreWidget";
import MissionCard from "@/components/MissionCard";
import BuySellPanel from "@/components/BuySellPanel";
import ActivityFeed from "@/components/ActivityFeed";
import ChatBox from "@/components/ChatBox";
import CandlestickChart from "@/components/CandlestickChart";
import StatusBadge from "@/components/StatusBadge";
import AuraWrapper from "@/components/AuraWrapper";
import { useWeb3 } from "@/lib/web3Provider";
import { useBondingCurve } from "@/hooks/useBondingCurve";
import { usePostMigrationPool } from "@/hooks/usePostMigrationPool";
import {
  getTokenFactory,
  formatUSDC,
  formatTokenAmount,
  formatPrice,
  formatNumber,
  type TokenRecord,
  type ArenaMetrics,
} from "@/lib/contracts";
import { shortAddress, addressLink, tokenLink } from "@/lib/arcscan";
import type { Token, Mission } from "@/lib/mockData";
import { resolveCreatorDisplayName } from "@/lib/mockData";

const TokenDetail = () => {
  const { address } = useParams<{ address: string }>();
  const { readProvider } = useWeb3();

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
      // Fetch pool spot price
      try {
        const poolPrice = await pool.getSpotPrice();
        if (poolPrice > 0n) setSpotPrice(poolPrice);
      } catch {}

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

  // Hype score
  const hypeScore = Math.min(
    100,
    Math.floor(
      bondingPct * 0.4 +
        Math.min(holders * 2, 30) +
        Math.min(buyVol / 50, 20) +
        Math.min(uniqueBuyers, 10)
    )
  );

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
    creatorName: record ? resolveCreatorDisplayName(record.creator) : "",
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
                      to={`/creator/${record.creator}`}
                      className="text-xs text-primary font-body hover:underline"
                    >
                      by {resolveCreatorDisplayName(record.creator)}
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

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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

          {/* Bonding curve */}
          <motion.div
            className="card-cartoon mb-6"
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
            <div className="progress-arcade h-5">
              <motion.div
                className="progress-arcade-fill"
                initial={{ width: 0 }}
                animate={{
                  width: `${graduated ? 100 : bondingPct}%`,
                }}
                transition={{ duration: 1.5 }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <p className="text-xs text-muted-foreground font-body">
                {graduated
                  ? "This token has graduated to the DEX pool."
                  : bondingPct >= 80
                    ? "Almost graduated! This token is about to hit DEX."
                    : `${raised.toFixed(2)} / 2,500 USDC raised`}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <CandlestickChart
                curveAddress={curveAddress}
                poolAddress={poolAddress}
                currentPrice={price}
                graduated={graduated}
              />
              <BuySellPanel
                curveAddress={curveAddress}
                tokenAddress={address || null}
                tokenSymbol={record.symbol}
                graduated={graduated}
                poolAddress={poolAddress}
              />
              <HypeScoreWidget score={hypeScore} />

              {/* Arena Status */}
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

              {/* Missions */}
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

              <ActivityFeed
                curveAddress={curveAddress}
                poolAddress={poolAddress}
                tokenSymbol={record.symbol}
              />
              <ChatBox
                title={`${record.symbol} CHAT`}
                context={record.name}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
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
                      to={`/creator/${record.creator}`}
                      className="text-primary hover:underline"
                    >
                      {shortAddress(record.creator)}
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
  );
};

export default TokenDetail;
