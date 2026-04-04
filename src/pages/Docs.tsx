import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { BookOpen, FileText, Code, Zap } from "lucide-react";

const sections = [
  { icon: BookOpen, title: "Getting Started", desc: "Learn how to launch your first memecoin on MEMEARENA in under 5 minutes." },
  { icon: FileText, title: "Tokenomics", desc: "Understand bonding curves, liquidity pools, and how pricing works." },
  { icon: Code, title: "Smart Contracts", desc: "Review our audited contracts and integration guides for developers." },
  { icon: Zap, title: "Arena Battles", desc: "How tokens compete, earn Hype Score, and climb the leaderboard." },
];

const Docs = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="container pt-24 pb-16">
      <motion.h1
        className="text-4xl md:text-5xl font-display text-primary text-glow-purple mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        📚 Documentation
      </motion.h1>
      <p className="text-muted-foreground font-body text-lg mb-12 max-w-2xl">
        Everything you need to know about launching, trading, and battling memecoins on MEMEARENA.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {sections.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            className="card-arcade p-6 rounded-2xl border-2 border-primary/20 bg-card/80 backdrop-blur-sm hover:border-primary/50 transition-colors"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-primary/20">
                <Icon className="text-primary" size={24} />
              </div>
              <h2 className="text-xl font-display text-foreground">{title}</h2>
            </div>
            <p className="text-muted-foreground font-body">{desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default Docs;
