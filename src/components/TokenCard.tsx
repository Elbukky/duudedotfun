import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Token } from "@/lib/mockData";
import StatusBadge from "./StatusBadge";

const TokenCard = ({ token, index = 0 }: { token: Token; index?: number }) => {
  return (
    <Link to={`/token/${token.id}`}>
      <motion.div
        className="card-cartoon hover:border-primary/60 transition-all cursor-pointer group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        whileHover={{ y: -4, scale: 1.02 }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <motion.span
              className="text-4xl"
              whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
              transition={{ duration: 0.4 }}
            >
              {token.logo}
            </motion.span>
            <div>
              <h3 className="font-display text-sm text-foreground">{token.name}</h3>
              <p className="text-xs text-muted-foreground font-body">${token.ticker}</p>
            </div>
          </div>
          <StatusBadge status={token.status} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-body">
            <span className="text-muted-foreground">Price</span>
            <span className="text-foreground">${token.price.toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-xs font-body">
            <span className="text-muted-foreground">24h</span>
            <span className={token.priceChange24h >= 0 ? "text-secondary" : "text-destructive"}>
              {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-xs font-body">
            <span className="text-muted-foreground">Holders</span>
            <span className="text-foreground">{token.holders.toLocaleString()}</span>
          </div>

          {/* Bonding progress */}
          <div className="pt-1">
            <div className="flex justify-between text-xs font-body mb-1">
              <span className="text-muted-foreground">Bonding</span>
              <span className="text-primary">{token.bondingProgress}%</span>
            </div>
            <div className="progress-arcade">
              <motion.div
                className="progress-arcade-fill"
                initial={{ width: 0 }}
                animate={{ width: `${token.bondingProgress}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-body">{token.launchedAt}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-body text-accent">⚡ {token.hypeScore}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default TokenCard;
