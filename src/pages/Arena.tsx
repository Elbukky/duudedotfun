import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import ArenaLeaderboardRow from "@/components/ArenaLeaderboardRow";
import TokenCard from "@/components/TokenCard";
import ChatBox from "@/components/ChatBox";
import { useArenaRegistry, type ArenaParticipantScore } from "@/hooks/useArenaRegistry";
import { useTokenFactory } from "@/hooks/useTokenFactory";
import { enrichedToToken, type Token } from "@/lib/mockData";
import { shortAddress } from "@/lib/arcscan";
import { formatPriceNum } from "@/lib/contracts";
import { ethers } from "ethers";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ended";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Derive award badges from leaderboard metrics
function getAwardBadges(leaderboard: ArenaParticipantScore[], tokenMap: Map<string, Token>) {
  if (leaderboard.length === 0) return [];
  const badges: { label: string; token: string }[] = [];

  const mostChaotic = [...leaderboard].sort((a, b) =>
    Number(b.metrics.sellCount + b.metrics.buyCount) - Number(a.metrics.sellCount + a.metrics.buyCount)
  )[0];
  if (mostChaotic) {
    const name = tokenMap.get(mostChaotic.token.toLowerCase())?.name || shortAddress(mostChaotic.token);
    badges.push({ label: "Most Chaotic", token: name });
  }

  const fastestGrowing = [...leaderboard].sort((a, b) =>
    Number(b.metrics.uniqueBuyerCount) - Number(a.metrics.uniqueBuyerCount)
  )[0];
  if (fastestGrowing && fastestGrowing.token !== mostChaotic?.token) {
    const name = tokenMap.get(fastestGrowing.token.toLowerCase())?.name || shortAddress(fastestGrowing.token);
    badges.push({ label: "Fastest Growing", token: name });
  }

  const communityFav = [...leaderboard].sort((a, b) =>
    Number(b.metrics.holderCount) - Number(a.metrics.holderCount)
  )[0];
  if (communityFav && communityFav.token !== mostChaotic?.token && communityFav.token !== fastestGrowing?.token) {
    const name = tokenMap.get(communityFav.token.toLowerCase())?.name || shortAddress(communityFav.token);
    badges.push({ label: "Community Fav", token: name });
  }

  return badges;
}

const Arena = () => {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const { battleData, loading: arenaLoading } = useArenaRegistry();
  const { enrichedTokens, loading: tokensLoading } = useTokenFactory();
  const [countdown, setCountdown] = useState(0);

  const loading = arenaLoading || tokensLoading;

  // Build display token map from enriched tokens
  const tokenMap = new Map<string, Token>();
  for (const e of enrichedTokens) {
    tokenMap.set(e.record.token.toLowerCase(), enrichedToToken(e));
  }

  // Countdown timer
  useEffect(() => {
    if (!battleData) return;
    setCountdown(battleData.timeRemaining);
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [battleData]);

  // Build leaderboard display tokens
  // Score is already normalized 0-100 by useArenaRegistry (uses computeScore)
  const leaderboardTokens: (Token & { arenaScore: string })[] = (battleData?.leaderboard || []).map((entry, i) => {
    const display = tokenMap.get(entry.token.toLowerCase());
    const baseToken: Token = display || {
      id: entry.token,
      name: shortAddress(entry.token),
      ticker: "???",
      logo: "?",
      price: 0,
      priceChange24h: 0,
      marketCap: 0,
      volume24h: parseFloat(ethers.formatEther(entry.metrics.totalBuyVolume + entry.metrics.totalSellVolume)),
      holders: Number(entry.metrics.holderCount),
      hypeScore: entry.score,
      bondingProgress: Number(entry.metrics.percentCompleteBps) / 100,
      category: "Degen",
      creatorId: entry.creator,
      creatorName: shortAddress(entry.creator),
      lore: "",
      launchedAt: "",
      arenaRank: i + 1,
      status: 'fighting',
    };
    return {
      ...baseToken,
      arenaRank: i + 1,
      // Use the same unified score — hypeScore and arenaScore are now identical
      arenaScore: entry.score.toString(),
      hypeScore: entry.score,
    };
  });

  // If no battle data, show all tokens sorted by hype as fallback
  const fallbackTokens: Token[] = !battleData || leaderboardTokens.length === 0
    ? enrichedTokens.map((e, i) => enrichedToToken(e, i + 1)).sort((a, b) => b.hypeScore - a.hypeScore)
    : [];

  const displayList = leaderboardTokens.length > 0 ? leaderboardTokens : fallbackTokens;
  const top3 = displayList.slice(0, 3);
  const rest = displayList.slice(3);

  const badges = getAwardBadges(battleData?.leaderboard || [], tokenMap);
  const participantCount = battleData?.participants.length || displayList.length;

  // Podium logo helper
  function PodiumLogo({ logo, name }: { logo: string; name: string }) {
    if (logo.startsWith("data:") || logo.startsWith("http")) {
      return <img src={logo} alt={name} className="w-12 h-12 rounded-lg object-cover mx-auto my-2" />;
    }
    return (
      <motion.span
        className="text-5xl block my-2"
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {logo || "?"}
      </motion.span>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl md:text-5xl font-display text-foreground mb-2">
              THE <span className="text-primary text-glow-purple">ARENA</span>
            </h1>
            <p className="text-muted-foreground font-body">Tokens battle for glory. Only the strongest graduate.</p>
            <div className="flex justify-center gap-4 mt-4">
              {battleData?.isActive ? (
                <span className="badge-sticker bg-accent/20 text-accent border-accent/40 text-xs">
                  Battle ends in {formatCountdown(countdown)}
                </span>
              ) : battleData && countdown <= 0 && Number(battleData.battle.endTime) > 0 ? (
                <span className="badge-sticker bg-destructive/20 text-destructive border-destructive/40 text-xs">
                  Battle ended
                </span>
              ) : (
                <span className="badge-sticker bg-muted/20 text-muted-foreground border-muted/40 text-xs">
                  No active battle
                </span>
              )}
              <span className="badge-sticker bg-secondary/20 text-secondary border-secondary/40 text-xs">
                {participantCount} fighter{participantCount !== 1 ? "s" : ""}
              </span>
            </div>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : displayList.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl font-display text-muted-foreground mb-4">No tokens in the arena yet</p>
              <p className="text-muted-foreground font-body">Launch a token to be the first fighter!</p>
            </div>
          ) : (
            <>
              {/* Podium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {top3.map((t, i) => {
                  const order = i === 0 ? "md:order-2" : i === 1 ? "md:order-1" : "md:order-3";
                  const scale = i === 0 ? "md:scale-105" : "";
                  const score = 'arenaScore' in t ? (t as any).arenaScore : t.hypeScore;
                  return (
                    <motion.div
                      key={t.id}
                      className={`${order} ${scale}`}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.15 }}
                    >
                      <Link to={`/token/${t.id}`} className="block">
                        <div className={`card-cartoon text-center cursor-pointer hover:border-primary/60 transition-all ${i === 0 ? "glow-gold border-accent/40" : ""}`}>
                          <span className="font-display text-2xl">{i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"}</span>
                          <PodiumLogo logo={t.logo} name={t.name} />
                          <h3 className="font-display text-sm text-foreground">{t.name}</h3>
                          <p className="text-xs text-primary font-body">${t.ticker}</p>
                          <p className="text-sm font-display mt-1 text-foreground">
                            {formatPriceNum(t.price)}
                          </p>
                          <p className="text-xs text-muted-foreground font-body mt-1">
                            {t.holders} holder{t.holders !== 1 ? "s" : ""} · {t.bondingProgress.toFixed(1)}% bonded
                          </p>
                          <p className="text-xs text-accent font-body mt-1">
                            Score: {score}/100
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* Award badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                  {badges.map((b, i) => (
                    <motion.div
                      key={b.label}
                      className="card-cartoon py-2 px-4 text-center"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                    >
                      <p className="font-display text-xs text-foreground">{b.label}</p>
                      <p className="text-xs text-muted-foreground font-body">{b.token}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* View toggle */}
              {rest.length > 0 && (
                <>
                  <div className="flex justify-end mb-4">
                    <div className="flex rounded-xl overflow-hidden border-2 border-primary/30">
                      <button onClick={() => setView('list')} className={`px-4 py-2 text-xs font-body ${view === 'list' ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>List</button>
                      <button onClick={() => setView('grid')} className={`px-4 py-2 text-xs font-body ${view === 'grid' ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>Grid</button>
                    </div>
                  </div>

                  {/* Rankings */}
                  {view === 'list' ? (
                    <div className="space-y-3">
                      {rest.map((t, i) => (
                        <ArenaLeaderboardRow
                          key={t.id}
                          token={t}
                          rank={i + 4}
                          index={i}
                          score={'arenaScore' in t ? (t as any).arenaScore : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rest.map((t, i) => (
                        <TokenCard key={t.id} token={t} index={i} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Arena Chat */}
          <div className="mt-8">
            <ChatBox title="ARENA CHAT" context="arena" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Arena;
