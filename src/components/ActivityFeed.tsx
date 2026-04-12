import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { shortAddress, txLink } from "@/lib/arcscan";

interface TradeActivity {
  id: string;
  type: "buy" | "sell";
  user: string;
  amount: string;
  tokens: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

// Arcscan API
const ARCSCAN_BASE = "https://testnet.arcscan.app/api/v2";

// Event topic0 hashes
const BUY_TOPIC = ethers.id("Buy(address,address,uint256,uint256,uint256)");
const SELL_TOPIC = ethers.id("Sell(address,uint256,uint256,uint256)");

// ABI fragments for decoding
const EVENTS_ABI = [
  "event Buy(address indexed buyer, address indexed recipient, uint256 usdcIn, uint256 tokensOut, uint256 fee)",
  "event Sell(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee)",
];

/** Filter null entries from topics array (Arcscan pads with nulls) */
function cleanTopics(topics: (string | null)[]): string[] {
  return topics.filter((t): t is string => t != null);
}

function formatTokenCount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

interface ActivityFeedProps {
  curveAddress: string | null;
  tokenSymbol: string;
}

const ActivityFeed = ({ curveAddress, tokenSymbol }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<TradeActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!curveAddress) {
      setLoading(false);
      return;
    }

    const fetchActivity = async () => {
      setLoading(true);
      try {
        const iface = new ethers.Interface(EVENTS_ABI);

        // Fetch ALL logs from Arcscan (no topic filter — API returns 422 with topic0 param)
        const res = await fetch(`${ARCSCAN_BASE}/addresses/${curveAddress}/logs`);
        if (!res.ok) {
          setActivities([]);
          return;
        }
        const data = await res.json();
        const allLogs = data.items || [];

        const items: TradeActivity[] = [];

        for (const log of allLogs) {
          try {
            if (!log.topics || !log.topics[0]) continue;
            const topic0 = log.topics[0].toLowerCase();
            const topics = cleanTopics(log.topics);

            if (topic0 === BUY_TOPIC.toLowerCase()) {
              const parsed = iface.parseLog({ topics, data: log.data });
              if (parsed) {
                const usdcIn = parseFloat(ethers.formatEther(parsed.args.usdcIn));
                const tokensOut = parseFloat(ethers.formatEther(parsed.args.tokensOut));
                items.push({
                  id: `buy-${log.transaction_hash}-${log.index}`,
                  type: "buy",
                  user: parsed.args.buyer,
                  amount: usdcIn < 0.01 ? usdcIn.toFixed(6) : usdcIn.toFixed(2),
                  tokens: formatTokenCount(tokensOut),
                  txHash: log.transaction_hash,
                  blockNumber: log.block_number || 0,
                  timestamp: log.block_timestamp
                    ? new Date(log.block_timestamp).getTime() / 1000
                    : 0,
                });
              }
            } else if (topic0 === SELL_TOPIC.toLowerCase()) {
              const parsed = iface.parseLog({ topics, data: log.data });
              if (parsed) {
                const tokensIn = parseFloat(ethers.formatEther(parsed.args.tokensIn));
                const usdcOut = parseFloat(ethers.formatEther(parsed.args.usdcOut));
                items.push({
                  id: `sell-${log.transaction_hash}-${log.index}`,
                  type: "sell",
                  user: parsed.args.seller,
                  amount: usdcOut < 0.01 ? usdcOut.toFixed(6) : usdcOut.toFixed(2),
                  tokens: formatTokenCount(tokensIn),
                  txHash: log.transaction_hash,
                  blockNumber: log.block_number || 0,
                  timestamp: log.block_timestamp
                    ? new Date(log.block_timestamp).getTime() / 1000
                    : 0,
                });
              }
            }
          } catch {
            // Skip unparseable logs
          }
        }

        // Sort by block number descending (newest first)
        items.sort((a, b) => b.blockNumber - a.blockNumber);
        setActivities(items);
      } catch (err) {
        console.error("Failed to fetch activity:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, [curveAddress]);

  return (
    <div className="card-cartoon">
      <h3 className="font-display text-sm text-foreground mb-4">LIVE ACTIVITY</h3>

      {loading ? (
        <p className="text-xs text-muted-foreground font-body animate-pulse py-4 text-center">
          Loading activity...
        </p>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body py-4 text-center">
          No trades yet — be the first to buy!
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {activities.map((a, i) => (
            <motion.a
              key={a.id}
              href={txLink(a.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <span>{a.type === "buy" ? "\uD83D\uDCC8" : "\uD83D\uDCC9"}</span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-body truncate ${a.type === "buy" ? "text-secondary" : "text-destructive"}`}
                >
                  <span className="text-muted-foreground">{shortAddress(a.user)} </span>
                  {a.type === "buy" ? "bought" : "sold"} {a.tokens} {tokenSymbol}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap">
                {a.amount} USDC
              </span>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
