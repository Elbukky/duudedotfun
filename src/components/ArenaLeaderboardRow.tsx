import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Token } from "@/lib/mockData";
import StatusBadge from "./StatusBadge";
import AuraWrapper from "./AuraWrapper";

const rankStyle = (rank: number) => {
  if (rank === 1) return "text-accent text-glow-gold text-2xl";
  if (rank === 2) return "text-muted-foreground text-xl";
  if (rank === 3) return "text-neon-pink text-xl";
  return "text-muted-foreground text-lg";
};

const rankEmoji = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
};

function RowLogo({ logo, name }: { logo: string; name: string }) {
  if (logo.startsWith("data:") || logo.startsWith("http")) {
    return <img src={logo} alt={name} className="w-8 h-8 rounded-lg object-cover" />;
  }
  return <span className="text-3xl">{logo || "?"}</span>;
}

const ArenaLeaderboardRow = ({ token, rank, index = 0, score }: { token: Token; rank: number; index?: number; score?: string }) => (
  <AuraWrapper token={token} rank={rank}>
    <Link to={`/token/${token.id}`}>
      <motion.div
        className={`card-cartoon flex items-center gap-4 ${rank <= 3 ? "border-accent/30" : ""} group cursor-pointer`}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.08 }}
        whileHover={{ x: 4, scale: 1.01 }}
      >
        <span className={`font-display w-10 text-center ${rankStyle(rank)}`}>
          {rankEmoji(rank)}
        </span>
        <RowLogo logo={token.logo} name={token.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-sm text-foreground truncate">{token.name}</h4>
            <StatusBadge status={token.status} />
          </div>
          <p className="text-xs text-muted-foreground font-body">${token.ticker} · {token.holders} holders</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-body text-foreground">${token.price < 0.000001 ? token.price.toExponential(2) : token.price.toFixed(6)}</p>
          <p className="text-xs font-body text-muted-foreground">
            {token.bondingProgress.toFixed(1)}% bonded
          </p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs text-muted-foreground font-body">{score ? "Score" : "Hype"}</p>
          <p className="text-sm font-display text-accent">{score || token.hypeScore}</p>
        </div>
      </motion.div>
    </Link>
  </AuraWrapper>
);

export default ArenaLeaderboardRow;
