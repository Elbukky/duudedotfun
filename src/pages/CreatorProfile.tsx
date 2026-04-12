import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Trophy, Rocket, Users, Star, Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { ethers } from "ethers";
import Navbar from "@/components/Navbar";
import TokenCard from "@/components/TokenCard";
import { useTokenFactory, type EnrichedToken } from "@/hooks/useTokenFactory";
import { useArenaRegistry } from "@/hooks/useArenaRegistry";
import { useWeb3 } from "@/lib/web3Provider";
import { getBondingCurve, type TokenRecord } from "@/lib/contracts";
import { enrichedToToken } from "@/lib/mockData";
import { shortAddress, addressLink } from "@/lib/arcscan";

const CreatorProfile = () => {
  const { address } = useParams<{ address: string }>();
  const { getCreatorStats, getCreatorTokens, getTokenRecord } = useTokenFactory();
  const { getCreatorRecord } = useArenaRegistry();
  const { readProvider } = useWeb3();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ tokensCreated: 0, tokensGraduated: 0, arenaBattlesWon: 0 });
  const [arenaRecord, setArenaRecord] = useState({ totalWins: 0, battlesParticipated: 0 });
  const [tokens, setTokens] = useState<EnrichedToken[]>([]);
  const [copied, setCopied] = useState(false);

  // Mock profile image (stored locally as base64 for now)
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const fetchCreatorData = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [creatorStats, creatorArena, tokenAddresses] = await Promise.all([
        getCreatorStats(address),
        getCreatorRecord(address),
        getCreatorTokens(address),
      ]);

      setStats(creatorStats);
      setArenaRecord(creatorArena);

      // Enrich each token with bonding curve data
      const enriched: EnrichedToken[] = await Promise.all(
        tokenAddresses.map(async (tokenAddr) => {
          try {
            const record = await getTokenRecord(tokenAddr);
            if (!record) throw new Error("No record");

            const curve = getBondingCurve(record.curve, readProvider);
            const [spotPrice, realUSDCRaised, realTokensSold] = await Promise.all([
              curve.spotPrice().catch(() => 0n),
              curve.realUSDCRaised().catch(() => 0n),
              curve.realTokensSold().catch(() => 0n),
            ]);

            let metrics = {
              totalBuyVolume: 0n, totalSellVolume: 0n,
              buyCount: 0n, sellCount: 0n,
              uniqueBuyerCount: 0n, holderCount: 0n,
              retainedBuyers: 0n, buyPressureBps: 0n, percentCompleteBps: 0n,
            };
            try {
              const m = await curve.getArenaMetrics();
              metrics = {
                totalBuyVolume: m[0], totalSellVolume: m[1],
                buyCount: m[2], sellCount: m[3],
                uniqueBuyerCount: m[4], holderCount: m[5],
                retainedBuyers: m[6], buyPressureBps: m[7], percentCompleteBps: m[8],
              };
            } catch {}

            return {
              record,
              spotPrice,
              realUSDCRaised,
              realTokensSold,
              holderCount: metrics.holderCount,
              bondingProgressBps: metrics.percentCompleteBps,
              totalBuyVolume: metrics.totalBuyVolume,
              totalSellVolume: metrics.totalSellVolume,
              buyCount: metrics.buyCount,
              sellCount: metrics.sellCount,
              uniqueBuyerCount: metrics.uniqueBuyerCount,
            };
          } catch {
            // Return a blank enriched token
            const blankRecord: TokenRecord = {
              token: tokenAddr,
              curve: ethers.ZeroAddress,
              vestingVault: ethers.ZeroAddress,
              creator: address,
              referrer: ethers.ZeroAddress,
              name: shortAddress(tokenAddr),
              symbol: "???",
              description: "",
              imageURI: "",
              links: { website: "", twitter: "", telegram: "", discord: "", extra: "" },
              createdAt: 0n,
              graduated: false,
              migrationPool: ethers.ZeroAddress,
            };
            return {
              record: blankRecord,
              spotPrice: 0n, realUSDCRaised: 0n, realTokensSold: 0n,
              holderCount: 0n, bondingProgressBps: 0n,
              totalBuyVolume: 0n, totalSellVolume: 0n,
              buyCount: 0n, sellCount: 0n, uniqueBuyerCount: 0n,
            };
          }
        })
      );

      setTokens(enriched);
    } catch (err) {
      console.error("Failed to fetch creator data:", err);
    } finally {
      setLoading(false);
    }
  }, [address, getCreatorStats, getCreatorRecord, getCreatorTokens, getTokenRecord, readProvider]);

  useEffect(() => {
    fetchCreatorData();
  }, [fetchCreatorData]);

  // Load saved profile image from localStorage
  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`profile-image-${address.toLowerCase()}`);
      if (saved) setProfileImage(saved);
    }
  }, [address]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target?.result as string;
      setProfileImage(dataUri);
      localStorage.setItem(`profile-image-${address.toLowerCase()}`, dataUri);
    };
    reader.readAsDataURL(file);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Convert to display tokens
  const displayTokens = tokens.map((e, i) => enrichedToToken(e, i + 1));
  const bestToken = [...displayTokens].sort((a, b) => b.hypeScore - a.hypeScore)[0];

  // Aggregate stats
  const totalHolders = tokens.reduce((sum, e) => sum + Number(e.holderCount), 0);
  const totalVolume = tokens.reduce((sum, e) => {
    return sum + parseFloat(ethers.formatEther(e.totalBuyVolume)) + parseFloat(ethers.formatEther(e.totalSellVolume));
  }, 0);

  // Reputation score: composite based on activity
  const reputation = Math.min(100, Math.floor(
    stats.tokensCreated * 10 +
    stats.tokensGraduated * 30 +
    stats.arenaBattlesWon * 20 +
    Math.min(totalHolders, 100) * 0.2 +
    Math.min(totalVolume / 100, 20)
  ));

  // Dynamic badges
  const creatorBadges: string[] = [];
  if (stats.tokensCreated >= 1) creatorBadges.push("🚀 Launcher");
  if (stats.tokensCreated >= 3) creatorBadges.push("🔥 Serial Creator");
  if (stats.tokensGraduated >= 1) creatorBadges.push("🎓 Graduate");
  if (stats.arenaBattlesWon >= 1) creatorBadges.push("🏆 Arena Champion");
  if (arenaRecord.battlesParticipated >= 3) creatorBadges.push("⚔️ Veteran");
  if (totalHolders >= 50) creatorBadges.push("👥 Community Builder");
  if (totalVolume >= 100) creatorBadges.push("💰 Volume King");
  if (creatorBadges.length === 0) creatorBadges.push("🌱 Newcomer");

  if (!address) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 px-4 text-center">
          <p className="text-muted-foreground font-body">Invalid creator address.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <motion.div
                className="card-cartoon text-center mb-6 glow-purple"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Profile Image */}
                <div className="relative inline-block mb-3">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-4 border-primary/30"
                    />
                  ) : (
                    <motion.span
                      className="text-7xl block"
                      animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                    >
                      🧑‍💻
                    </motion.span>
                  )}
                  <label className="absolute bottom-0 right-0 bg-primary/80 text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-primary text-xs">
                    +
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>

                <h1 className="font-display text-2xl text-foreground">{shortAddress(address)}</h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground font-body font-mono">{address}</p>
                  <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground">
                    {copied ? <Check size={12} className="text-secondary" /> : <Copy size={12} />}
                  </button>
                  <a href={addressLink(address)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink size={12} />
                  </a>
                </div>

                {/* Badges */}
                <div className="flex justify-center gap-2 mt-4 flex-wrap">
                  {creatorBadges.map((b) => (
                    <motion.span
                      key={b}
                      className="badge-sticker text-xs bg-accent/20 text-accent border-accent/40"
                      whileHover={{ scale: 1.1 }}
                    >
                      {b}
                    </motion.span>
                  ))}
                </div>
              </motion.div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {[
                  { icon: <Star size={16} className="text-accent" />, label: "Reputation", value: reputation },
                  { icon: <Rocket size={16} className="text-primary" />, label: "Launches", value: stats.tokensCreated },
                  { icon: <Trophy size={16} className="text-secondary" />, label: "Arena Wins", value: stats.arenaBattlesWon },
                  { icon: <Users size={16} className="text-neon-blue" />, label: "Total Holders", value: totalHolders.toLocaleString() },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    className="card-cartoon text-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="flex justify-center mb-1">{s.icon}</div>
                    <p className="font-display text-xl text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground font-body">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="card-cartoon text-center">
                  <p className="font-display text-lg text-foreground">{stats.tokensGraduated}</p>
                  <p className="text-xs text-muted-foreground font-body">Graduated</p>
                </div>
                <div className="card-cartoon text-center">
                  <p className="font-display text-lg text-foreground">{arenaRecord.battlesParticipated}</p>
                  <p className="text-xs text-muted-foreground font-body">Battles</p>
                </div>
                <div className="card-cartoon text-center">
                  <p className="font-display text-lg text-foreground">
                    {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}K` : totalVolume.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">Total Vol (USDC)</p>
                </div>
              </div>

              {/* Reputation Bar */}
              <div className="card-cartoon mb-8">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-body text-muted-foreground">Reputation Score</span>
                  <span className="font-display text-sm text-accent">{reputation} / 100</span>
                </div>
                <div className="progress-arcade h-5">
                  <motion.div
                    className="progress-arcade-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${reputation}%` }}
                    transition={{ duration: 1.5 }}
                  />
                </div>
              </div>

              {/* Best Performing */}
              {bestToken && (
                <div className="mb-8">
                  <h2 className="font-display text-lg text-foreground mb-4">🏆 BEST <span className="text-accent">PERFORMER</span></h2>
                  <div className="max-w-sm">
                    <TokenCard token={bestToken} />
                  </div>
                </div>
              )}

              {/* All tokens */}
              <h2 className="font-display text-lg text-foreground mb-4">🚀 ALL <span className="text-primary">LAUNCHES</span></h2>
              {displayTokens.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayTokens.map((t, i) => (
                    <TokenCard key={t.id} token={t} index={i} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground font-body py-8">No tokens launched yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorProfile;
