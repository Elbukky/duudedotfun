import { motion } from "framer-motion";
import { useState } from "react";
import { Upload, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import { categories } from "@/lib/mockData";

const LaunchToken = () => {
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Degen');
  const [launched, setLaunched] = useState(false);

  if (launched) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 px-4">
          <div className="container max-w-lg mx-auto">
            <motion.div
              className="card-cartoon text-center py-16 glow-green"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.8 }}
            >
              <motion.span
                className="text-7xl block mb-4"
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                🚀
              </motion.span>
              <h2 className="font-display text-2xl text-foreground mb-2">TOKEN LAUNCHED!</h2>
              <p className="text-secondary font-display text-lg text-glow-green mb-2">${ticker || 'TOKEN'}</p>
              <p className="text-muted-foreground font-body text-sm mb-6">Your meme has entered the arena. Time to fight!</p>
              <motion.span className="badge-sticker bg-secondary/20 text-secondary border-secondary/40 text-sm">
                ⚔️ READY TO FIGHT
              </motion.span>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-display text-foreground text-center mb-2">
              🎮 CREATE YOUR <span className="text-primary text-glow-purple">FIGHTER</span>
            </h1>
            <p className="text-center text-muted-foreground font-body mb-8">Your token will enter today's arena battle.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <motion.div className="space-y-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <div className="card-cartoon space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Token Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PepeFighter" className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Ticker</label>
                  <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="PEPEF" maxLength={8} className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Meme Lore</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell the world about your meme..." rows={3} className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Logo</label>
                  <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground font-body">Click to upload your meme logo</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-2 block">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.filter(c => c !== 'All').map((c) => (
                      <motion.button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`badge-sticker text-xs cursor-pointer ${category === c ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-muted"}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {c}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => setLaunched(true)}
                className="w-full btn-arcade bg-primary text-primary-foreground border-primary py-4 text-sm flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles size={18} /> LAUNCH TOKEN
              </motion.button>
            </motion.div>

            {/* Live Preview */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="card-cartoon glow-purple sticky top-24">
                <h3 className="font-display text-xs text-muted-foreground text-center mb-4">⚔️ BATTLE CARD PREVIEW</h3>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-muted border-2 border-primary/30 mx-auto flex items-center justify-center mb-3">
                    <span className="text-3xl">🎭</span>
                  </div>
                  <h4 className="font-display text-lg text-foreground">{name || 'Your Token'}</h4>
                  <p className="font-display text-sm text-primary">${ticker || 'TICKER'}</p>
                  <p className="text-xs text-muted-foreground font-body mt-2 max-w-xs mx-auto">
                    {description || 'Your meme lore will appear here...'}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <span className="badge-sticker text-[10px] bg-primary/20 text-primary border-primary/40">{category}</span>
                    <span className="badge-sticker text-[10px] bg-accent/20 text-accent border-accent/40">✨ NEW</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Meme Power</span>
                      <span className="text-accent">⚡ ??</span>
                    </div>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Status</span>
                      <span className="text-secondary">Ready to Fight</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchToken;
