import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Rocket, Swords, TrendingUp, Users, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useEffect } from "react";
import mascot from "@/assets/mascot.png";
import pepeAstronaut from "@/assets/pepe-astronaut.png";
import logo from "@/assets/logo.png";
import TokenCard from "@/components/TokenCard";
import ArenaLeaderboardRow from "@/components/ArenaLeaderboardRow";
import { enrichedToToken } from "@/lib/mockData";
import { useTokenFactory } from "@/hooks/useTokenFactory";
import { useArenaRegistry } from "@/hooks/useArenaRegistry";
import { useProfiles } from "@/lib/profileProvider";
import { shortAddress } from "@/lib/arcscan";
import Navbar from "@/components/Navbar";
import { ethers } from "ethers";

const Index = () => {
  const { enrichedTokens, loading, tokenCount } = useTokenFactory();
  const { battleData } = useArenaRegistry();
  const { getDisplayName, getProfile, batchResolve } = useProfiles();

  // Convert to display tokens
  const displayTokens = enrichedTokens.map((e, i) => enrichedToToken(e, i + 1));

  // Trending: sorted by hypeScore descending
  const trending = [...displayTokens].sort((a, b) => b.hypeScore - a.hypeScore).slice(0, 4);

  // Arena top: use battle leaderboard if available, fallback to hype sorted
  const arenaTokens = (() => {
    if (battleData && battleData.leaderboard.length > 0) {
      // Match leaderboard entries to display tokens
      return battleData.leaderboard.slice(0, 3).map((entry, i) => {
        const display = displayTokens.find(t => t.id.toLowerCase() === entry.token.toLowerCase());
        if (display) return { ...display, arenaRank: i + 1 };
        // Fallback: create minimal display from leaderboard data
        return {
          id: entry.token,
          name: shortAddress(entry.token),
          ticker: "???",
          logo: "?",
          price: 0,
          priceChange24h: 0,
          marketCap: 0,
          volume24h: 0,
          holders: Number(entry.metrics.holderCount),
          hypeScore: Number(entry.score),
          bondingProgress: Number(entry.metrics.percentCompleteBps) / 100,
          category: "Degen",
          creatorId: entry.creator,
          creatorName: shortAddress(entry.creator),
          lore: "",
          launchedAt: "",
          arenaRank: i + 1,
          status: 'fighting' as const,
        };
      });
    }
    return [...displayTokens].sort((a, b) => b.hypeScore - a.hypeScore).slice(0, 3);
  })();

  // Recently launched: sorted by creation time descending
  const recent = [...displayTokens].reverse().slice(0, 4);

  // Top creators: aggregate from tokens
  const creatorMap = new Map<string, { address: string; tokens: number; totalHype: number; graduated: number }>();
  for (const e of enrichedTokens) {
    const addr = e.record.creator;
    const existing = creatorMap.get(addr.toLowerCase()) || { address: addr, tokens: 0, totalHype: 0, graduated: 0 };
    existing.tokens++;
    existing.totalHype += Number(enrichedToToken(e).hypeScore);
    if (e.record.graduated) existing.graduated++;
    creatorMap.set(addr.toLowerCase(), existing);
  }
  const topCreators = [...creatorMap.values()]
    .sort((a, b) => b.totalHype - a.totalHype)
    .slice(0, 5);

  // Batch resolve creator profiles for display names
  useEffect(() => {
    const addrs = topCreators.map((c) => c.address);
    if (addrs.length > 0) batchResolve(addrs);
  }, [topCreators.length]); // re-run when list changes

  // Stats
  const totalVolume = enrichedTokens.reduce((sum, e) => {
    const buy = parseFloat(ethers.formatEther(e.totalBuyVolume));
    const sell = parseFloat(ethers.formatEther(e.totalSellVolume));
    const pool = parseFloat(ethers.formatEther(e.postMigrationVolume));
    return sum + buy + sell + pool;
  }, 0);
  const totalHolders = enrichedTokens.reduce((sum, e) => sum + Number(e.holderCount), 0);
  const battleCount = battleData ? Number(battleData.battle.endTime) > 0 ? 1 : 0 : 0;

  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 overflow-hidden relative">
        {/* Faint moon */}
        <div className="absolute top-12 right-[10%] w-24 h-24 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-muted/30 to-muted/10 opacity-30 blur-[1px] pointer-events-none" />
        <div className="absolute top-16 right-[12%] w-6 h-6 md:w-8 md:h-8 rounded-full bg-muted/20 opacity-20 pointer-events-none" />
        <div className="absolute top-24 right-[11%] w-3 h-3 md:w-5 md:h-5 rounded-full bg-muted/15 opacity-20 pointer-events-none" />

        {/* Twinkling stars */}
        {[
          { top: '8%', left: '5%', size: 3, delay: 0 },
          { top: '15%', left: '20%', size: 2, delay: 0.5 },
          { top: '5%', left: '40%', size: 4, delay: 1 },
          { top: '20%', left: '60%', size: 2, delay: 0.3 },
          { top: '10%', left: '75%', size: 3, delay: 0.8 },
          { top: '30%', left: '85%', size: 2, delay: 1.2 },
          { top: '25%', left: '15%', size: 2, delay: 0.7 },
          { top: '12%', left: '50%', size: 3, delay: 0.4 },
          { top: '35%', left: '92%', size: 2, delay: 1.5 },
          { top: '6%', left: '88%', size: 3, delay: 0.2 },
        ].map((star, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-foreground/15 pointer-events-none"
            style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            transition={{ repeat: Infinity, duration: 2 + star.delay, delay: star.delay }}
          />
        ))}

        {/* Floating Pepe astronaut - right side middle */}
        <motion.img
          src={pepeAstronaut}
          alt="Pepe astronaut floating"
          className="absolute opacity-[0.18] pointer-events-none w-32 md:w-44 lg:w-52 hidden md:block"
          style={{ top: '30%', right: '18%' }}
          width={512}
          height={512}
          loading="lazy"
          animate={{ y: [0, -14, 0], rotate: [0, 5, -3, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        />
        {/* Floating Pepe astronaut - bottom left */}
        <motion.img
          src={pepeAstronaut}
          alt="Pepe astronaut floating"
          className="absolute opacity-[0.12] pointer-events-none w-20 md:w-28"
          style={{ bottom: '5%', left: '40%', transform: 'scaleX(-1)' }}
          width={512}
          height={512}
          loading="lazy"
          animate={{ y: [0, -8, 0], rotate: [0, -4, 3, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
        />
        {/* Small Pepe astronaut - top right corner */}
        <motion.img
          src={pepeAstronaut}
          alt="Pepe astronaut floating"
          className="absolute opacity-[0.1] pointer-events-none w-16 md:w-20 hidden lg:block"
          style={{ top: '8%', right: '3%', transform: 'scaleX(-1) rotate(15deg)' }}
          width={512}
          height={512}
          loading="lazy"
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }}
        />
        <div className="container">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="badge-sticker bg-primary/20 text-primary border-primary/40 mb-4 inline-block">
                  ⚡ duude.fun IS LIVE
                </span>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-display leading-tight mb-4">
                  <span
                    className="inline-block animate-gradient-shift"
                    style={{
                      background: 'linear-gradient(90deg, hsl(var(--neon-purple)), hsl(var(--slime-green)), hsl(var(--gold)), hsl(var(--neon-purple)))',
                      backgroundSize: '300% 100%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    DUDE,
                    <br />
                    JUST LAUNCH
                    <br />
                    IT...
                  </span>
                </h1>
                <p className="text-lg md:text-2xl font-display text-muted-foreground mb-4 tracking-wide">
                  LAUNCH YOUR <span className="text-primary">MEME.</span> PROVE YOUR <span className="text-accent">HYPE.</span>
                </p>
                <p className="text-lg text-muted-foreground font-body max-w-md mx-auto lg:mx-0 mb-8">
                  Create meme coins, trade them instantly, and battle for glory on duude.fun — the ultimate memecoin arena.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link to="/launch">
                    <motion.button
                      className="btn-arcade bg-primary text-primary-foreground border-primary px-8 py-4 text-sm w-full sm:w-auto flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Rocket size={18} /> LAUNCH A COIN
                    </motion.button>
                  </Link>
                  <Link to="/arena">
                    <motion.button
                      className="btn-arcade bg-secondary/10 text-secondary border-secondary/40 px-8 py-4 text-sm w-full sm:w-auto flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Swords size={18} /> ENTER ARENA
                    </motion.button>
                  </Link>
                </div>
              </motion.div>
            </div>
            {/* Mascot fly-by loop */}
            <motion.div
              className="flex-1 flex justify-center relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 relative overflow-visible">
                <motion.img
                  src={mascot}
                  alt="Pepe in Rocket"
                  className="w-64 md:w-80 lg:w-96 drop-shadow-2xl absolute"
                  width={512}
                  height={512}
                  animate={{
                    x: [-220, 0, 60, 200, 420],
                    y: [180, 0, -40, -140, -350],
                    rotate: [15, 0, -8, -20, -35],
                    scale: [0.5, 1, 1, 0.85, 0.4],
                    opacity: [0, 1, 1, 0.7, 0],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 5,
                    ease: "easeInOut",
                    times: [0, 0.2, 0.45, 0.75, 1],
                  }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y-2 border-primary/20 py-4 bg-card/50">
        <div className="container flex flex-wrap justify-center gap-6 md:gap-12">
          {[
            { icon: <Zap size={16} className="text-accent" />, label: "Tokens Launched", value: loading ? "..." : tokenCount.toLocaleString() },
            { icon: <Users size={16} className="text-secondary" />, label: "Total Holders", value: loading ? "..." : totalHolders.toLocaleString() },
            { icon: <TrendingUp size={16} className="text-primary" />, label: "Total Volume", value: loading ? "..." : formatVolume(totalVolume) },
            { icon: <Swords size={16} className="text-destructive" />, label: "Arena Battles", value: battleCount.toString() },
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 text-center">
              {icon}
              <div>
                <p className="font-display text-sm text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground font-body">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="py-16 px-4">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-display text-foreground">
              🔥 TRENDING <span className="text-primary">COINS</span>
            </h2>
            <Link to="/arena" className="text-primary text-sm font-body flex items-center gap-1 hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : trending.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trending.map((t, i) => (
                <TokenCard key={t.id} token={t} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-body mb-4">No tokens launched yet. Be the first!</p>
              <Link to="/launch">
                <motion.button
                  className="btn-arcade bg-primary text-primary-foreground border-primary px-6 py-3 text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Rocket size={16} className="inline mr-2" /> LAUNCH FIRST TOKEN
                </motion.button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Arena Preview */}
      <section className="py-16 px-4 bg-card/30">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-display text-foreground">
              ⚔️ ARENA <span className="text-secondary">BATTLES</span>
            </h2>
            <Link to="/arena" className="text-secondary text-sm font-body flex items-center gap-1 hover:underline">
              Full leaderboard <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : arenaTokens.length > 0 ? (
            <div className="space-y-3">
              {arenaTokens.map((t, i) => (
                <ArenaLeaderboardRow key={t.id} token={t} rank={i + 1} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground font-body">No active arena battles yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Recently Launched */}
      <section className="py-16 px-4">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-display text-foreground mb-8">
            ✨ RECENTLY <span className="text-accent">LAUNCHED</span>
          </h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : recent.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recent.map((t, i) => (
                <TokenCard key={t.id} token={t} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground font-body">No tokens launched yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Top Creators */}
      <section className="py-16 px-4 bg-card/30">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-display text-foreground mb-8">
            👑 TOP <span className="text-primary">CREATORS</span>
          </h2>
          {topCreators.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {topCreators.map((c, i) => {
                const profile = getProfile(c.address);
                const creatorLink = profile?.username ? `/u/${profile.username}` : `/creator/${c.address}`;
                return (
                <Link key={c.address} to={creatorLink}>
                  <motion.div
                    className="card-cartoon text-center cursor-pointer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -4 }}
                  >
                    <motion.span className="text-4xl block mb-2" whileHover={{ scale: 1.2, rotate: 10 }}>
                      {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🧑‍💻"}
                    </motion.span>
                    <h4 className="font-display text-xs text-foreground">{getDisplayName(c.address)}</h4>
                    <p className="text-xs text-muted-foreground font-body">
                      {c.tokens} launch{c.tokens !== 1 ? "es" : ""} · {c.graduated} graduated
                    </p>
                    <div className="mt-2 flex justify-center gap-1 flex-wrap">
                      {c.tokens >= 3 && (
                        <span className="badge-sticker text-[8px] bg-accent/10 text-accent border-accent/30">Serial Launcher</span>
                      )}
                      {c.graduated >= 1 && (
                        <span className="badge-sticker text-[8px] bg-secondary/10 text-secondary border-secondary/30">Graduate</span>
                      )}
                    </div>
                  </motion.div>
                </Link>
                );
              })}
            </div>
          ) : !loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground font-body">No creators yet. Launch the first token!</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-display text-foreground text-center mb-12">
            🎮 HOW IT <span className="text-primary">WORKS</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { step: "1", icon: "🚀", title: "LAUNCH", desc: "Create your meme coin in seconds. Pick a name, add your lore, and deploy." },
              { step: "2", icon: "⚔️", title: "BATTLE", desc: "Your token enters the arena. Compete for hype, volume, and holders." },
              { step: "3", icon: "👑", title: "WIN", desc: "Top tokens graduate to DEX. Earn badges, rep, and eternal meme glory." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="card-cartoon text-center"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <motion.span
                  className="text-5xl block mb-3"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
                >
                  {item.icon}
                </motion.span>
                <span className="badge-sticker bg-primary/20 text-primary border-primary/40 text-[10px] mb-2">STEP {item.step}</span>
                <h3 className="font-display text-lg text-foreground mt-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-body mt-2">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container">
          <motion.div
            className="card-cartoon text-center max-w-2xl mx-auto py-12 glow-purple"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h2 className="text-3xl md:text-4xl font-display text-foreground mb-4">
              READY TO <span className="text-primary text-glow-purple">FIGHT?</span>
            </h2>
            <p className="text-muted-foreground font-body mb-8 max-w-md mx-auto">
              Your meme could be the next champion. Launch now and enter the arena.
            </p>
            <Link to="/launch">
              <motion.button
                className="btn-arcade bg-primary text-primary-foreground border-primary px-10 py-4 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🚀 LAUNCH YOUR MEME NOW
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-primary/20 py-8 px-4">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display text-sm tracking-wider" style={{ background: 'linear-gradient(90deg, hsl(var(--neon-purple)), hsl(var(--slime-green)), hsl(var(--gold)))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 6px hsl(var(--neon-purple) / 0.3))' }}>duude.fun</span>
          <p className="text-xs text-muted-foreground font-body">© 2026 duude.fun. Built for degens, by degens.</p>
          <div className="flex gap-4">
            <a href="https://x.com/Duudedotfun" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground font-body hover:text-primary cursor-pointer transition-colors">Twitter</a>
            <Link to="/docs" className="text-xs text-muted-foreground font-body hover:text-primary cursor-pointer transition-colors">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
