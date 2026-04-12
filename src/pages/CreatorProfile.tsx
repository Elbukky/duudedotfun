import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Trophy, Rocket, Users, Star, Loader2, Copy, Check, ExternalLink, Pencil, Lock, Unlock, Clock, Droplets, Wallet } from "lucide-react";
import { ethers } from "ethers";
import Navbar from "@/components/Navbar";
import TokenCard from "@/components/TokenCard";
import { useTokenFactory, type EnrichedToken } from "@/hooks/useTokenFactory";
import { useArenaRegistry } from "@/hooks/useArenaRegistry";
import { useVestingVault, type VestingInfo } from "@/hooks/useVestingVault";
import { useWeb3 } from "@/lib/web3Provider";
import { getBondingCurve, getPostMigrationPool, getLaunchToken, type TokenRecord, formatTokenAmount, formatUSDC, formatPrice, formatNumber } from "@/lib/contracts";
import { enrichedToToken, resolveCreatorDisplayName, getCreatorName, setCreatorName as saveCreatorName } from "@/lib/mockData";
import { shortAddress, addressLink } from "@/lib/arcscan";
import { toast } from "sonner";

const CreatorProfile = () => {
  const { address } = useParams<{ address: string }>();
  const { getCreatorStats, getCreatorTokens, getTokenRecord, enrichedTokens: allEnrichedTokens } = useTokenFactory();
  const { getCreatorRecord } = useArenaRegistry();
  const { readProvider, address: connectedAddress } = useWeb3();
  const { getVestingInfo, claim, claiming } = useVestingVault();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ tokensCreated: 0, tokensGraduated: 0, arenaBattlesWon: 0 });
  const [arenaRecord, setArenaRecord] = useState({ totalWins: 0, battlesParticipated: 0 });
  const [tokens, setTokens] = useState<EnrichedToken[]>([]);
  const [copied, setCopied] = useState(false);

  // Vesting data for tokens that have vesting vaults
  const [vestingData, setVestingData] = useState<{ record: TokenRecord; info: VestingInfo }[]>([]);

  // LP fee earnings for graduated tokens
  const [lpEarnings, setLpEarnings] = useState<{ record: TokenRecord; lpBalance: bigint; claimable: bigint }[]>([]);

  // Portfolio: tokens held by this address (not just created)
  const [portfolio, setPortfolio] = useState<{ record: TokenRecord; balance: bigint; spotPrice: bigint; value: number }[]>([]);

  // Mock profile image (stored locally as base64 for now)
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Creator name system (localStorage, MongoDB later)
  const [creatorNameValue, setCreatorNameValue] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Is the connected wallet viewing their own profile?
  const isOwnProfile = !!(connectedAddress && address && connectedAddress.toLowerCase() === address.toLowerCase());

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
              postMigrationVolume: 0n,
              poolSpotPrice: 0n,
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
              postMigrationVolume: 0n, poolSpotPrice: 0n,
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

  // Load saved profile image and creator name from localStorage
  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`profile-image-${address.toLowerCase()}`);
      if (saved) setProfileImage(saved);
      setCreatorNameValue(getCreatorName(address));
    }
  }, [address]);

  // Fetch vesting data for this creator's tokens (check if connected wallet has vesting)
  useEffect(() => {
    if (!connectedAddress || tokens.length === 0) {
      setVestingData([]);
      return;
    }
    const fetchVesting = async () => {
      const results: { record: TokenRecord; info: VestingInfo }[] = [];
      for (const t of tokens) {
        if (t.record.vestingVault && t.record.vestingVault !== ethers.ZeroAddress) {
          const info = await getVestingInfo(t.record.vestingVault, connectedAddress);
          if (info) {
            results.push({ record: t.record, info });
          }
        }
      }
      setVestingData(results);
    };
    fetchVesting();
  }, [tokens, connectedAddress, getVestingInfo]);

  // Fetch LP fee earnings for graduated tokens (only for connected user viewing own profile)
  useEffect(() => {
    if (!connectedAddress || !isOwnProfile || tokens.length === 0) {
      setLpEarnings([]);
      return;
    }
    const fetchLP = async () => {
      const results: { record: TokenRecord; lpBalance: bigint; claimable: bigint }[] = [];
      for (const t of tokens) {
        if (t.record.graduated && t.record.migrationPool && t.record.migrationPool !== ethers.ZeroAddress) {
          try {
            const pool = getPostMigrationPool(t.record.migrationPool, readProvider);
            const [lpBal, claim] = await Promise.all([
              pool.getLPBalance(connectedAddress).catch(() => 0n),
              pool.getLPFeeClaimable(connectedAddress).catch(() => 0n),
            ]);
            if (lpBal > 0n || claim > 0n) {
              results.push({ record: t.record, lpBalance: lpBal, claimable: claim });
            }
          } catch {}
        }
      }
      setLpEarnings(results);
    };
    fetchLP();
  }, [tokens, connectedAddress, isOwnProfile, readProvider]);

  // Fetch portfolio: check balanceOf for all tokens in the factory
  useEffect(() => {
    if (!address || allEnrichedTokens.length === 0) {
      setPortfolio([]);
      return;
    }
    const fetchPortfolio = async () => {
      const results: { record: TokenRecord; balance: bigint; spotPrice: bigint; value: number }[] = [];
      await Promise.all(
        allEnrichedTokens.map(async (e) => {
          try {
            const token = getLaunchToken(e.record.token, readProvider);
            const bal = await token.balanceOf(address);
            if (bal > 0n) {
              // Use pool price for graduated tokens, bonding curve price otherwise
              const price = (e.record.graduated && e.poolSpotPrice > 0n) ? e.poolSpotPrice : e.spotPrice;
              const balFloat = parseFloat(ethers.formatEther(bal));
              const priceFloat = parseFloat(ethers.formatEther(price));
              results.push({
                record: e.record,
                balance: bal,
                spotPrice: price,
                value: balFloat * priceFloat,
              });
            }
          } catch {}
        })
      );
      // Sort by value descending
      results.sort((a, b) => b.value - a.value);
      setPortfolio(results);
    };
    fetchPortfolio();
  }, [address, allEnrichedTokens, readProvider]);

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

  const handleSaveName = () => {
    if (!address) return;
    const trimmed = nameInput.trim();
    saveCreatorName(address, trimmed);
    setCreatorNameValue(trimmed);
    setEditingName(false);
  };

  const handleStartEditName = () => {
    setNameInput(creatorNameValue);
    setEditingName(true);
  };

  const handleClaim = async (vaultAddress: string, tokenSymbol: string) => {
    try {
      toast.info(`Claiming vested ${tokenSymbol}...`);
      await claim(vaultAddress);
      toast.success(`Claimed ${tokenSymbol} tokens!`);
      // Refresh vesting data
      if (connectedAddress) {
        const info = await getVestingInfo(vaultAddress, connectedAddress);
        if (info) {
          setVestingData((prev) =>
            prev.map((v) =>
              v.record.vestingVault === vaultAddress ? { ...v, info } : v
            )
          );
        }
      }
    } catch (err: any) {
      toast.error(err.reason || err.message || "Claim failed");
    }
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
                  {isOwnProfile && (
                    <label className="absolute bottom-0 right-0 bg-primary/80 text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-primary text-xs">
                      +
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                <h1 className="font-display text-2xl text-foreground">
                  {creatorNameValue || shortAddress(address)}
                </h1>
                {isOwnProfile && (
                  <div className="mt-1">
                    {editingName ? (
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                          placeholder="Enter your name..."
                          maxLength={32}
                          className="bg-muted border border-primary/30 rounded-lg px-3 py-1 text-sm text-foreground font-body focus:outline-none focus:border-primary/60 w-48"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveName}
                          className="text-xs font-body text-secondary hover:text-secondary/80 px-2 py-1 rounded bg-secondary/10"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          className="text-xs font-body text-muted-foreground hover:text-foreground px-2 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartEditName}
                        className="text-xs font-body text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Pencil size={10} />
                        {creatorNameValue ? "Edit name" : "Set display name"}
                      </button>
                    )}
                  </div>
                )}
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
                  <h2 className="font-display text-lg text-foreground mb-4">BEST <span className="text-accent">PERFORMER</span></h2>
                  <div className="max-w-sm">
                    <TokenCard token={bestToken} />
                  </div>
                </div>
              )}

              {/* All tokens */}
              <h2 className="font-display text-lg text-foreground mb-4">ALL <span className="text-primary">LAUNCHES</span></h2>
              {displayTokens.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayTokens.map((t, i) => (
                    <TokenCard key={t.id} token={t} index={i} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground font-body py-8">No tokens launched yet.</p>
              )}

              {/* Vesting & Claims */}
              {vestingData.length > 0 && (
                <div className="mt-8">
                  <h2 className="font-display text-lg text-foreground mb-4">
                    VESTING & <span className="text-accent">CLAIMS</span>
                  </h2>
                  <div className="space-y-3">
                    {vestingData.map((v) => {
                      const { record, info } = v;
                      return (
                        <motion.div
                          key={record.vestingVault}
                          className="card-cartoon"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <Link
                                to={`/token/${record.token}`}
                                className="font-display text-sm text-foreground hover:text-primary transition-colors"
                              >
                                {record.name}{" "}
                                <span className="text-primary">${record.symbol}</span>
                              </Link>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {info.isCliffPassed ? (
                                <Unlock size={14} className="text-secondary" />
                              ) : (
                                <Lock size={14} className="text-muted-foreground" />
                              )}
                              <span className="text-xs font-body text-muted-foreground">
                                {info.isCliffPassed ? "Cliff passed" : `Cliff: ${info.cliffDaysLeft}d left`}
                              </span>
                            </div>
                          </div>

                          {/* Vesting progress bar */}
                          <div className="mb-2">
                            <div className="flex justify-between text-xs font-body mb-1">
                              <span className="text-muted-foreground">Vested</span>
                              <span className="text-foreground">{info.percentVested.toFixed(1)}%</span>
                            </div>
                            <div className="progress-arcade h-3">
                              <motion.div
                                className="progress-arcade-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${info.percentVested}%` }}
                                transition={{ duration: 1 }}
                              />
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-2 text-xs font-body mb-3">
                            <div>
                              <span className="text-muted-foreground block">Total</span>
                              <span className="text-foreground">{formatTokenAmount(info.schedule.totalAllocation)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Claimed</span>
                              <span className="text-foreground">{formatTokenAmount(info.schedule.claimed)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Claimable</span>
                              <span className="text-secondary">{formatTokenAmount(info.schedule.claimableNow)}</span>
                            </div>
                          </div>

                          {/* Time remaining */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-body mb-3">
                            <Clock size={12} />
                            <span>{info.vestingDaysLeft > 0 ? `${info.vestingDaysLeft} days until fully vested` : "Fully vested"}</span>
                          </div>

                          {/* Claim button — only on own profile and when there's something to claim */}
                          {isOwnProfile && info.schedule.claimableNow > 0n && (
                            <motion.button
                              onClick={() => handleClaim(record.vestingVault, record.symbol)}
                              disabled={claiming}
                              className="w-full btn-arcade py-2.5 text-xs bg-secondary text-secondary-foreground border-secondary disabled:opacity-50"
                              whileHover={{ scale: claiming ? 1 : 1.02 }}
                              whileTap={{ scale: claiming ? 1 : 0.98 }}
                            >
                              {claiming ? "Claiming..." : `Claim ${formatTokenAmount(info.schedule.claimableNow)} ${record.symbol}`}
                            </motion.button>
                          )}

                          {isOwnProfile && info.schedule.claimableNow === 0n && !info.isCliffPassed && (
                            <p className="text-xs text-muted-foreground font-body text-center py-1">
                              Tokens locked until cliff ends ({info.cliffDaysLeft}d)
                            </p>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LP Fee Earnings */}
              {lpEarnings.length > 0 && (
                <div className="mt-8">
                  <h2 className="font-display text-lg text-foreground mb-4">
                    <Droplets size={18} className="inline mr-1 text-primary" />
                    LP FEE <span className="text-primary">EARNINGS</span>
                  </h2>
                  <div className="space-y-3">
                    {lpEarnings.map((lp) => {
                      const lpBalNum = parseFloat(ethers.formatEther(lp.lpBalance));
                      const claimNum = parseFloat(ethers.formatEther(lp.claimable));
                      return (
                        <motion.div
                          key={lp.record.migrationPool}
                          className="card-cartoon"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Link
                              to={`/token/${lp.record.token}`}
                              className="font-display text-sm text-foreground hover:text-primary transition-colors"
                            >
                              {lp.record.name}{" "}
                              <span className="text-primary">${lp.record.symbol}</span>
                            </Link>
                            <span className="text-[9px] font-body text-accent bg-accent/10 px-1.5 py-0.5 rounded">DEX</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs font-body">
                            <div>
                              <span className="text-muted-foreground block">LP Balance</span>
                              <span className="text-foreground">{lpBalNum < 0.01 ? lpBalNum.toExponential(2) : lpBalNum.toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Claimable Fees</span>
                              <span className="text-secondary">{claimNum < 0.01 ? claimNum.toFixed(6) : claimNum.toFixed(4)} USDC</span>
                            </div>
                          </div>
                          {claimNum > 0 && (
                            <Link
                              to="/liquidity"
                              className="mt-3 block text-center text-xs font-body text-primary hover:underline"
                            >
                              Go to Liquidity page to claim
                            </Link>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                  <Link
                    to="/liquidity"
                    className="mt-4 block text-center text-xs font-body text-primary hover:underline"
                  >
                    Manage all LP positions
                  </Link>
                </div>
              )}

              {/* Portfolio — tokens held by this address */}
              {portfolio.length > 0 && (
                <div className="mt-8">
                  <h2 className="font-display text-lg text-foreground mb-4">
                    <Wallet size={18} className="inline mr-1 text-secondary" />
                    TOKEN <span className="text-secondary">PORTFOLIO</span>
                  </h2>
                  {/* Total portfolio value */}
                  <div className="card-cartoon mb-4 text-center">
                    <p className="text-xs text-muted-foreground font-body mb-1">Total Portfolio Value</p>
                    <p className="font-display text-2xl text-secondary">
                      ${formatNumber(portfolio.reduce((sum, p) => sum + p.value, 0))}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {portfolio.map((p) => {
                      const balFloat = parseFloat(ethers.formatEther(p.balance));
                      return (
                        <motion.div
                          key={p.record.token}
                          className="card-cartoon"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex items-center justify-between">
                            <Link
                              to={`/token/${p.record.token}`}
                              className="font-display text-sm text-foreground hover:text-primary transition-colors flex items-center gap-2"
                            >
                              {p.record.imageURI ? (
                                <img src={p.record.imageURI} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                  {p.record.symbol.charAt(0)}
                                </div>
                              )}
                              <span>
                                {p.record.name}{" "}
                                <span className="text-primary">${p.record.symbol}</span>
                              </span>
                            </Link>
                            <div className="text-right">
                              <p className="font-display text-sm text-foreground">
                                ${formatNumber(p.value)}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs font-body mt-2">
                            <div>
                              <span className="text-muted-foreground block">Balance</span>
                              <span className="text-foreground">{formatTokenAmount(p.balance)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Price</span>
                              <span className="text-foreground">{formatPrice(p.spotPrice)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Status</span>
                              <span className={p.record.graduated ? "text-secondary" : "text-accent"}>
                                {p.record.graduated ? "DEX" : "Bonding"}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorProfile;
