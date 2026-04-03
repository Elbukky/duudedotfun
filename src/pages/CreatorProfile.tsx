import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Trophy, Rocket, Users, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import TokenCard from "@/components/TokenCard";
import { mockCreators, mockTokens } from "@/lib/mockData";

const CreatorProfile = () => {
  const { id } = useParams();
  const creator = mockCreators.find((c) => c.id === id) || mockCreators[0];
  const tokens = mockTokens.filter((t) => t.creatorId === creator.id);
  const bestToken = [...tokens].sort((a, b) => b.hypeScore - a.hypeScore)[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>

          {/* Profile Header */}
          <motion.div
            className="card-cartoon text-center mb-6 glow-purple"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.span
              className="text-7xl block mb-3"
              animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              {creator.avatar}
            </motion.span>
            <h1 className="font-display text-2xl text-foreground">{creator.name}</h1>
            <p className="text-xs text-muted-foreground font-body mt-1">0xd3g3...n420</p>

            {/* Badges */}
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {creator.badges.map((b) => (
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
              { icon: <Star size={16} className="text-accent" />, label: "Reputation", value: creator.reputation },
              { icon: <Rocket size={16} className="text-primary" />, label: "Launches", value: creator.launches },
              { icon: <Trophy size={16} className="text-secondary" />, label: "Arena Wins", value: creator.wins },
              { icon: <Users size={16} className="text-neon-blue" />, label: "Total Holders", value: creator.totalHolders.toLocaleString() },
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

          {/* Reputation Bar */}
          <div className="card-cartoon mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-body text-muted-foreground">Reputation Score</span>
              <span className="font-display text-sm text-accent">{creator.reputation} / 100</span>
            </div>
            <div className="progress-arcade h-5">
              <motion.div
                className="progress-arcade-fill"
                initial={{ width: 0 }}
                animate={{ width: `${creator.reputation}%` }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((t, i) => (
              <TokenCard key={t.id} token={t} index={i} />
            ))}
          </div>
          {tokens.length === 0 && (
            <p className="text-center text-muted-foreground font-body py-8">No tokens launched yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorProfile;
