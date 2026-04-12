import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import { getBondingCurve } from "@/lib/contracts";
import { shortAddress, txLink } from "@/lib/arcscan";

interface TradeActivity {
  id: string;
  type: "buy" | "sell";
  user: string;
  amount: string;
  tokens: string;
  txHash: string;
  blockNumber: number;
}

const BUY_EVENT =
  "event Buy(address indexed buyer, address indexed recipient, uint256 usdcIn, uint256 tokensOut, uint256 fee)";
const SELL_EVENT =
  "event Sell(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee)";

interface ActivityFeedProps {
  curveAddress: string | null;
  tokenSymbol: string;
}

const ActivityFeed = ({ curveAddress, tokenSymbol }: ActivityFeedProps) => {
  const { readProvider } = useWeb3();
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
        const iface = new ethers.Interface([BUY_EVENT, SELL_EVENT]);
        const curve = getBondingCurve(curveAddress, readProvider);
        const currentBlock = await readProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);

        const [buyLogs, sellLogs] = await Promise.all([
          curve.queryFilter(curve.filters.Buy(), fromBlock, currentBlock).catch(() => []),
          curve.queryFilter(curve.filters.Sell(), fromBlock, currentBlock).catch(() => []),
        ]);

        const items: TradeActivity[] = [];

        for (const log of buyLogs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed) {
              const usdcIn = parseFloat(ethers.formatEther(parsed.args.usdcIn));
              const tokensOut = parseFloat(ethers.formatEther(parsed.args.tokensOut));
              items.push({
                id: `buy-${log.transactionHash}-${log.index}`,
                type: "buy",
                user: parsed.args.buyer,
                amount: usdcIn < 0.01 ? usdcIn.toFixed(6) : usdcIn.toFixed(2),
                tokens:
                  tokensOut >= 1_000_000_000
                    ? `${(tokensOut / 1_000_000_000).toFixed(2)}B`
                    : tokensOut >= 1_000_000
                      ? `${(tokensOut / 1_000_000).toFixed(2)}M`
                      : tokensOut >= 1_000
                        ? `${(tokensOut / 1_000).toFixed(2)}K`
                        : tokensOut.toFixed(2),
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            }
          } catch {}
        }

        for (const log of sellLogs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed) {
              const tokensIn = parseFloat(ethers.formatEther(parsed.args.tokensIn));
              const usdcOut = parseFloat(ethers.formatEther(parsed.args.usdcOut));
              items.push({
                id: `sell-${log.transactionHash}-${log.index}`,
                type: "sell",
                user: parsed.args.seller,
                amount: usdcOut < 0.01 ? usdcOut.toFixed(6) : usdcOut.toFixed(2),
                tokens:
                  tokensIn >= 1_000_000_000
                    ? `${(tokensIn / 1_000_000_000).toFixed(2)}B`
                    : tokensIn >= 1_000_000
                      ? `${(tokensIn / 1_000_000).toFixed(2)}M`
                      : tokensIn >= 1_000
                        ? `${(tokensIn / 1_000).toFixed(2)}K`
                        : tokensIn.toFixed(2),
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            }
          } catch {}
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
  }, [curveAddress, readProvider]);

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
