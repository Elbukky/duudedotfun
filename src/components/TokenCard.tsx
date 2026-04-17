import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Token } from "@/lib/mockData";
import { formatPriceNum } from "@/lib/contracts";
import StatusBadge from "./StatusBadge";
import AuraWrapper from "./AuraWrapper";
import BondingProgressBar from "./BondingProgressBar";

function TokenLogo({ logo, name, size = "text-4xl" }: { logo: string; name: string; size?: string }) {
  if (logo.startsWith("data:") || logo.startsWith("http")) {
    const sizeClass = size === "text-4xl" ? "w-10 h-10" : size === "text-5xl" ? "w-12 h-12" : "w-8 h-8";
    return <img src={logo} alt={name} className={`${sizeClass} rounded-lg object-cover`} />;
  }
  return <span className={size}>{logo || "?"}</span>;
}

const TokenCard = ({ token, index = 0, rank }: { token: Token; index?: number; rank?: number }) => {
  return (
    <AuraWrapper token={token} rank={rank}>
      <Link to={`/token/${token.id}`}>
        <motion.div
          className="card-cartoon hover:border-primary/60 transition-all cursor-pointer group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
                transition={{ duration: 0.4 }}
              >
                <TokenLogo logo={token.logo} name={token.name} />
              </motion.div>
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
              <span className="text-foreground">{formatPriceNum(token.price)}</span>
            </div>
            <div className="flex justify-between text-xs font-body">
              <span className="text-muted-foreground">Holders</span>
              <span className="text-foreground">{token.holders.toLocaleString()}</span>
            </div>

            {/* Bonding progress */}
            {token.status !== 'graduated' ? (
              <div className="pt-1">
                <div className="flex justify-between text-xs font-body mb-1">
                  <span className="text-muted-foreground">Bonding</span>
                  <span className="text-primary">{token.bondingProgress.toFixed(1)}%</span>
                </div>
                <BondingProgressBar
                  progress={token.bondingProgress}
                  mascotSize={24}
                  animDelay={index * 0.1}
                />
              </div>
            ) : (
              <div className="pt-1">
                <span className="badge-sticker text-[10px] bg-secondary/20 text-secondary border-secondary/40">ON DEX</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-body">{token.launchedAt}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-body text-accent">⚡ {token.hypeScore}</span>
            </div>
          </div>
        </motion.div>
      </Link>
    </AuraWrapper>
  );
};

export default TokenCard;
