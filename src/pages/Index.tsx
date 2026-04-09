import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Rocket, Swords, TrendingUp, Users, Zap, ArrowRight } from "lucide-react";
import mascot from "@/assets/mascot.png";
import TokenCard from "@/components/TokenCard";
import ArenaLeaderboardRow from "@/components/ArenaLeaderboardRow";
import { mockTokens, mockCreators } from "@/lib/mockData";
import Navbar from "@/components/Navbar";

const Index = () => {
  const trending = [...mockTokens].sort((a, b) => b.hypeScore - a.hypeScore).slice(0, 4);
  const arenaTop = [...mockTokens].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 3);
  const recent = [...mockTokens].slice(-4);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 overflow-hidden">
        <div className="container">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-lg md:text-xl font-body italic text-muted-foreground mb-4">"Dude, just launch it..."</p>
                <span className="badge-sticker bg-primary/20 text-primary border-primary/40 mb-4 inline-block">
                  ⚡ duude.fun IS LIVE
                </span>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-display leading-tight mb-4">
                  <span className="text-foreground">LAUNCH YOUR</span>
                  <br />
                  <span className="text-primary text-glow-purple">MEME.</span>
                  <br />
                  <span className="text-secondary text-glow-green">PROVE YOUR</span>
                  <br />
                  <span className="text-accent text-glow-gold">HYPE.</span>
                </h1>
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
            <motion.div
              className="flex-1 flex justify-center relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.img
                src={mascot}
                alt="MemeArena Mascot"
                className="w-64 md:w-80 lg:w-96 drop-shadow-2xl"
                width={512}
                height={512}
                animate={{ y: [0, -15, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              />
              {/* Floating badges */}
              {['🔥 HOT', '💎 DEGEN', '🚀 MOON'].map((label, i) => (
                <motion.span
                  key={label}
                  className="badge-sticker bg-primary/20 text-primary border-primary/40 absolute text-xs"
                  style={{ top: `${20 + i * 30}%`, right: `${5 + i * 10}%` }}
                  animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2 + i * 0.5, delay: i * 0.3 }}
                >
                  {label}
                </motion.span>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y-2 border-primary/20 py-4 bg-card/50">
        <div className="container flex flex-wrap justify-center gap-6 md:gap-12">
          {[
            { icon: <Zap size={16} className="text-accent" />, label: "Tokens Launched", value: "2,847" },
            { icon: <Users size={16} className="text-secondary" />, label: "Total Traders", value: "18.5K" },
            { icon: <TrendingUp size={16} className="text-primary" />, label: "24h Volume", value: "$4.2M" },
            { icon: <Swords size={16} className="text-destructive" />, label: "Arena Battles", value: "156" },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trending.map((t, i) => (
              <TokenCard key={t.id} token={t} index={i} />
            ))}
          </div>
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
          <div className="space-y-3">
            {arenaTop.map((t, i) => (
              <ArenaLeaderboardRow key={t.id} token={t} rank={i + 1} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Recently Launched */}
      <section className="py-16 px-4">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-display text-foreground mb-8">
            ✨ RECENTLY <span className="text-accent">LAUNCHED</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recent.map((t, i) => (
              <TokenCard key={t.id} token={t} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Top Creators */}
      <section className="py-16 px-4 bg-card/30">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-display text-foreground mb-8">
            👑 TOP <span className="text-primary">CREATORS</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {mockCreators.map((c, i) => (
              <Link key={c.id} to={`/creator/${c.id}`}>
                <motion.div
                  className="card-cartoon text-center cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                >
                  <motion.span className="text-4xl block mb-2" whileHover={{ scale: 1.2, rotate: 10 }}>
                    {c.avatar}
                  </motion.span>
                  <h4 className="font-display text-xs text-foreground">{c.name}</h4>
                  <p className="text-xs text-muted-foreground font-body">{c.launches} launches · {c.wins} wins</p>
                  <div className="mt-2 flex justify-center gap-1 flex-wrap">
                    {c.badges.slice(0, 2).map((b) => (
                      <span key={b} className="badge-sticker text-[8px] bg-accent/10 text-accent border-accent/30">{b}</span>
                    ))}
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
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
            {['Twitter', 'Discord', 'Docs'].map((l) => (
              <span key={l} className="text-xs text-muted-foreground font-body hover:text-primary cursor-pointer transition-colors">{l}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
