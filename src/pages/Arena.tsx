import { motion } from "framer-motion";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import ArenaLeaderboardRow from "@/components/ArenaLeaderboardRow";
import TokenCard from "@/components/TokenCard";
import ChatBox from "@/components/ChatBox";
import { mockTokens } from "@/lib/mockData";

const badges = [
  { label: "🔥 Most Chaotic", token: "ChaosMonkey" },
  { label: "📈 Fastest Growing", token: "GhostPepe" },
  { label: "❤️ Community Fav", token: "PepeFighter" },
];

const Arena = () => {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const sorted = [...mockTokens].sort((a, b) => b.hypeScore - a.hypeScore);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl md:text-5xl font-display text-foreground mb-2">
              ⚔️ THE <span className="text-primary text-glow-purple">ARENA</span>
            </h1>
            <p className="text-muted-foreground font-body">Tokens battle for glory. Only the strongest graduate.</p>
            <div className="flex justify-center gap-4 mt-4">
              <span className="badge-sticker bg-accent/20 text-accent border-accent/40 text-xs">
                ⏰ Battle ends in 4h 22m
              </span>
              <span className="badge-sticker bg-secondary/20 text-secondary border-secondary/40 text-xs">
                {mockTokens.length} fighters
              </span>
            </div>
          </motion.div>

          {/* Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {top3.map((t, i) => {
              const order = i === 0 ? "md:order-2" : i === 1 ? "md:order-1" : "md:order-3";
              const scale = i === 0 ? "md:scale-105" : "";
              return (
                <motion.div
                  key={t.id}
                  className={`${order} ${scale}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className={`card-cartoon text-center ${i === 0 ? "glow-gold border-accent/40" : ""}`}>
                    <span className="font-display text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                    <motion.span
                      className="text-5xl block my-2"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
                    >
                      {t.logo}
                    </motion.span>
                    <h3 className="font-display text-sm text-foreground">{t.name}</h3>
                    <p className="text-xs text-primary font-body">${t.ticker}</p>
                    <p className={`text-lg font-display mt-1 ${t.priceChange24h >= 0 ? "text-secondary" : "text-destructive"}`}>
                      {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                    </p>
                    <p className="text-xs text-accent font-body mt-1">⚡ Hype: {t.hypeScore}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Award badges */}
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

          {/* View toggle */}
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
                <ArenaLeaderboardRow key={t.id} token={t} rank={i + 4} index={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((t, i) => (
                <TokenCard key={t.id} token={t} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Arena;
