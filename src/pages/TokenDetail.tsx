import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Users, BarChart3, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import HypeScoreWidget from "@/components/HypeScoreWidget";
import MissionCard from "@/components/MissionCard";
import BuySellPanel from "@/components/BuySellPanel";
import ActivityFeed from "@/components/ActivityFeed";
import ChatBox from "@/components/ChatBox";
import CandlestickChart from "@/components/CandlestickChart";
import StatusBadge from "@/components/StatusBadge";
import { mockTokens, mockMissions, mockActivities } from "@/lib/mockData";

const TokenDetail = () => {
  const { id } = useParams();
  const token = mockTokens.find((t) => t.id === id) || mockTokens[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>

          {/* Header */}
          <motion.div
            className="card-cartoon mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <motion.span className="text-6xl" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                {token.logo}
              </motion.span>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-display text-2xl md:text-3xl text-foreground">{token.name}</h1>
                  <span className="font-display text-lg text-primary">${token.ticker}</span>
                  <StatusBadge status={token.status} />
                </div>
                <p className="text-sm text-muted-foreground font-body mt-1">{token.lore}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Link to={`/creator/${token.creatorId}`} className="text-xs text-primary font-body hover:underline">
                    by {token.creatorName}
                  </Link>
                  <span className="text-xs text-muted-foreground">· {token.launchedAt}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl text-foreground">${token.price.toFixed(6)}</p>
                <p className={`text-sm font-body ${token.priceChange24h >= 0 ? "text-secondary" : "text-destructive"}`}>
                  {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: <BarChart3 size={14} />, label: "Market Cap", value: `$${(token.marketCap / 1000).toFixed(0)}K` },
              { icon: <BarChart3 size={14} />, label: "24h Volume", value: `$${(token.volume24h / 1000).toFixed(0)}K` },
              { icon: <Users size={14} />, label: "Holders", value: token.holders.toLocaleString() },
              { icon: <Clock size={14} />, label: "Arena Rank", value: `#${token.arenaRank}` },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                className="card-cartoon text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">{s.icon}<span className="text-xs font-body">{s.label}</span></div>
                <p className="font-display text-lg text-foreground">{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Bonding curve */}
          <motion.div className="card-cartoon mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="flex justify-between mb-2">
              <span className="text-xs font-body text-muted-foreground">Bonding Curve Progress</span>
              <span className="text-xs font-display text-primary">{token.bondingProgress}%</span>
            </div>
            <div className="progress-arcade h-5">
              <motion.div
                className="progress-arcade-fill"
                initial={{ width: 0 }}
                animate={{ width: `${token.bondingProgress}%` }}
                transition={{ duration: 1.5 }}
              />
            </div>
            <p className="text-xs text-muted-foreground font-body mt-2">
              {token.bondingProgress >= 80 ? "🔥 Almost graduated! This token is about to hit DEX." : "Fill the bonding curve to graduate to DEX."}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <CandlestickChart basePrice={token.price} />
              <BuySellPanel tokenName={token.ticker} price={token.price} />
              <HypeScoreWidget score={token.hypeScore} />

              {/* Arena Rank */}
              <div className="card-cartoon">
                <h3 className="font-display text-sm text-foreground mb-3">⚔️ ARENA STATUS</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-2xl text-accent">#{token.arenaRank}</p>
                    <p className="text-xs text-muted-foreground font-body">Current Rank</p>
                  </div>
                  <StatusBadge status={token.status} />
                  <div className="text-right">
                    <p className="font-display text-sm text-foreground">2h 34m</p>
                    <p className="text-xs text-muted-foreground font-body">Time Remaining</p>
                  </div>
                </div>
              </div>

              {/* Missions */}
              <div>
                <h3 className="font-display text-sm text-foreground mb-3">🏆 MEME MISSIONS</h3>
                <div className="space-y-3">
                  {mockMissions.map((m, i) => (
                    <MissionCard key={m.id} mission={m} index={i} />
                  ))}
                </div>
              </div>

              <ActivityFeed activities={mockActivities} />
              <ChatBox title={`💬 ${token.ticker} CHAT`} context={token.name} />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <BuySellPanel tokenName={token.ticker} price={token.price} />

              <div className="card-cartoon">
                <h3 className="font-display text-xs text-muted-foreground mb-3">LINKS</h3>
                <div className="space-y-2">
                  {['Website', 'Twitter', 'Telegram'].map((l) => (
                    <div key={l} className="flex items-center justify-between text-xs font-body">
                      <span className="text-foreground">{l}</span>
                      <ExternalLink size={12} className="text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenDetail;
