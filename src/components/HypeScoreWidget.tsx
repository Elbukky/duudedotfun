import { motion } from "framer-motion";

const HypeScoreWidget = ({ score }: { score: number }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="card-cartoon flex flex-col items-center py-6">
      <h3 className="font-display text-sm text-muted-foreground mb-4">HYPE SCORE</h3>
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <motion.circle
            cx="70" cy="70" r={radius} fill="none"
            stroke="url(#hypeGradient)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="hypeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--neon-purple))" />
              <stop offset="100%" stopColor="hsl(var(--slime-green))" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-display text-foreground"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-muted-foreground font-body">/ 100</span>
        </div>
      </div>
      <motion.p
        className={`mt-3 font-display text-xs ${score >= 80 ? "text-secondary text-glow-green" : score >= 50 ? "text-accent text-glow-gold" : "text-muted-foreground"}`}
        animate={score >= 80 ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {score >= 80 ? "🔥 ON FIRE" : score >= 50 ? "⚡ HEATING UP" : "💤 WARMING UP"}
      </motion.p>
    </div>
  );
};

export default HypeScoreWidget;
