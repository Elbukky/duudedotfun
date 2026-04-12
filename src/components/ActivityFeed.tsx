import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { shortAddress, txLink } from "@/lib/arcscan";

interface TradeActivity {
  id: string;
  type: "buy" | "sell";
  source: "bonding" | "dex";
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
const SWAP_TOPIC = ethers.id("Swap(address,address,uint256,uint256,uint256,uint256)");

// ABI fragments for decoding
const BONDING_ABI = [
  "event Buy(address indexed buyer, address indexed recipient, uint256 usdcIn, uint256 tokensOut, uint256 fee)",
  "event Sell(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee)",
];
const POOL_ABI = [
  "event Swap(address indexed sender, address indexed to, uint256 tokenIn, uint256 usdcIn, uint256 tokenOut, uint256 usdcOut)",
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

function timeAgo(timestamp: number): string {
  if (!timestamp) return "";
  const diffSec = Math.floor(Date.now() / 1000 - timestamp);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

interface ActivityFeedProps {
  curveAddress: string | null;
  poolAddress?: string | null;
  tokenSymbol: string;
}

const ActivityFeed = ({ curveAddress, poolAddress, tokenSymbol }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<TradeActivity[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!curveAddress && !poolAddress) {
      setInitialLoading(false);
      return;
    }

    const fetchActivity = async () => {
      // Prevent concurrent fetches
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        const bondingIface = new ethers.Interface(BONDING_ABI);
        const poolIface = new ethers.Interface(POOL_ABI);
        const items: TradeActivity[] = [];

        // Fetch bonding curve logs
        if (curveAddress) {
          const res = await fetch(`${ARCSCAN_BASE}/addresses/${curveAddress}/logs`);
          if (res.ok) {
            const data = await res.json();
            const allLogs = data.items || [];

            for (const log of allLogs) {
              try {
                if (!log.topics || !log.topics[0]) continue;
                const topic0 = log.topics[0].toLowerCase();
                const topics = cleanTopics(log.topics);

                if (topic0 === BUY_TOPIC.toLowerCase()) {
                  const parsed = bondingIface.parseLog({ topics, data: log.data });
                  if (parsed) {
                    const usdcIn = parseFloat(ethers.formatEther(parsed.args.usdcIn));
                    const tokensOut = parseFloat(ethers.formatEther(parsed.args.tokensOut));
                    items.push({
                      id: `buy-${log.transaction_hash}-${log.index}`,
                      type: "buy",
                      source: "bonding",
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
                  const parsed = bondingIface.parseLog({ topics, data: log.data });
                  if (parsed) {
                    const tokensIn = parseFloat(ethers.formatEther(parsed.args.tokensIn));
                    const usdcOut = parseFloat(ethers.formatEther(parsed.args.usdcOut));
                    items.push({
                      id: `sell-${log.transaction_hash}-${log.index}`,
                      type: "sell",
                      source: "bonding",
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
          }
        }

        // Fetch PostMigrationPool Swap events (after graduation)
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          const res = await fetch(`${ARCSCAN_BASE}/addresses/${poolAddress}/logs`);
          if (res.ok) {
            const data = await res.json();
            const allLogs = data.items || [];

            for (const log of allLogs) {
              try {
                if (!log.topics || !log.topics[0]) continue;
                const topic0 = log.topics[0].toLowerCase();
                if (topic0 !== SWAP_TOPIC.toLowerCase()) continue;

                const topics = cleanTopics(log.topics);
                const parsed = poolIface.parseLog({ topics, data: log.data });
                if (!parsed) continue;

                const tokenIn = parsed.args.tokenIn;
                const usdcIn = parsed.args.usdcIn;
                const tokenOut = parsed.args.tokenOut;
                const usdcOut = parsed.args.usdcOut;

                // Buy tokens: usdcIn > 0, tokenOut > 0
                if (usdcIn > 0n && tokenOut > 0n) {
                  const usdcF = parseFloat(ethers.formatEther(usdcIn));
                  const tokF = parseFloat(ethers.formatEther(tokenOut));
                  items.push({
                    id: `dex-buy-${log.transaction_hash}-${log.index}`,
                    type: "buy",
                    source: "dex",
                    user: parsed.args.sender,
                    amount: usdcF < 0.01 ? usdcF.toFixed(6) : usdcF.toFixed(2),
                    tokens: formatTokenCount(tokF),
                    txHash: log.transaction_hash,
                    blockNumber: log.block_number || 0,
                    timestamp: log.block_timestamp
                      ? new Date(log.block_timestamp).getTime() / 1000
                      : 0,
                  });
                }
                // Sell tokens: tokenIn > 0, usdcOut > 0
                else if (tokenIn > 0n && usdcOut > 0n) {
                  const tokF = parseFloat(ethers.formatEther(tokenIn));
                  const usdcF = parseFloat(ethers.formatEther(usdcOut));
                  items.push({
                    id: `dex-sell-${log.transaction_hash}-${log.index}`,
                    type: "sell",
                    source: "dex",
                    user: parsed.args.sender,
                    amount: usdcF < 0.01 ? usdcF.toFixed(6) : usdcF.toFixed(2),
                    tokens: formatTokenCount(tokF),
                    txHash: log.transaction_hash,
                    blockNumber: log.block_number || 0,
                    timestamp: log.block_timestamp
                      ? new Date(log.block_timestamp).getTime() / 1000
                      : 0,
                  });
                }
              } catch {
                // Skip unparseable logs
              }
            }
          }
        }

        // Sort by block number descending (newest first)
        items.sort((a, b) => b.blockNumber - a.blockNumber);
        setActivities(items);
      } catch (err) {
        console.error("Failed to fetch activity:", err);
      } finally {
        setInitialLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchActivity();
    // Background refresh every 15 seconds — no loading screen
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, [curveAddress, poolAddress]);

  return (
    <div className="card-cartoon">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm text-foreground">LIVE ACTIVITY</h3>
        {activities.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-body">
            auto-updates every 15s
          </span>
        )}
      </div>

      {initialLoading && activities.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body animate-pulse py-4 text-center">
          Loading activity...
        </p>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body py-4 text-center">
          No trades yet — be the first to buy!
        </p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {activities.map((a) => (
            <a
              key={a.id}
              href={txLink(a.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm">{a.type === "buy" ? "\uD83D\uDCC8" : "\uD83D\uDCC9"}</span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-body truncate ${a.type === "buy" ? "text-secondary" : "text-destructive"}`}
                >
                  <span className="text-muted-foreground">{shortAddress(a.user)} </span>
                  {a.type === "buy" ? "bought" : "sold"} {a.tokens} {tokenSymbol}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.source === "dex" && (
                  <span className="text-[9px] font-body text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                    DEX
                  </span>
                )}
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap block">
                    {a.amount} USDC
                  </span>
                  {a.timestamp > 0 && (
                    <span className="text-[9px] text-muted-foreground/60 font-body whitespace-nowrap block">
                      {timeAgo(a.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
