import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";

interface TradePoint {
  price: number;
  type: "buy" | "sell";
  blockNumber: number;
  timestamp?: number;
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandlestickChartProps {
  curveAddress: string | null;
  poolAddress?: string | null;
  currentPrice: number;
  graduated?: boolean;
}

// Arcscan (Blockscout v2) API for fetching logs — more reliable than RPC eth_getLogs
const ARCSCAN_BASE = "https://testnet.arcscan.app/api/v2";

// Event signatures for topic0 matching
const BUY_TOPIC = ethers.id("Buy(address,address,uint256,uint256,uint256)");
const SELL_TOPIC = ethers.id("Sell(address,uint256,uint256,uint256)");
const SWAP_TOPIC = ethers.id("Swap(address,address,uint256,uint256,uint256,uint256)");

// ABIs for parsing
const BONDING_EVENTS = [
  "event Buy(address indexed buyer, address indexed recipient, uint256 usdcIn, uint256 tokensOut, uint256 fee)",
  "event Sell(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee)",
];
const POOL_EVENTS = [
  "event Swap(address indexed sender, address indexed to, uint256 tokenIn, uint256 usdcIn, uint256 tokenOut, uint256 usdcOut)",
];

async function fetchLogsFromArcscan(
  contractAddress: string,
  topic0?: string
): Promise<any[]> {
  try {
    let url = `${ARCSCAN_BASE}/addresses/${contractAddress}/logs`;
    if (topic0) url += `?topic0=${topic0}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

const CandlestickChart = ({
  curveAddress,
  poolAddress,
  currentPrice,
  graduated = false,
}: CandlestickChartProps) => {
  const [trades, setTrades] = useState<TradePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("ALL");

  // Fetch trade events from Arcscan API
  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      const points: TradePoint[] = [];

      try {
        const bondingIface = new ethers.Interface(BONDING_EVENTS);
        const poolIface = new ethers.Interface(POOL_EVENTS);

        // Fetch bonding curve Buy+Sell events (always, even after graduation for history)
        if (curveAddress) {
          const [buyLogs, sellLogs] = await Promise.all([
            fetchLogsFromArcscan(curveAddress, BUY_TOPIC),
            fetchLogsFromArcscan(curveAddress, SELL_TOPIC),
          ]);

          for (const log of buyLogs) {
            try {
              const parsed = bondingIface.parseLog({
                topics: log.topics,
                data: log.data,
              });
              if (parsed) {
                const usdcIn = parseFloat(ethers.formatEther(parsed.args.usdcIn));
                const tokensOut = parseFloat(ethers.formatEther(parsed.args.tokensOut));
                if (tokensOut > 0) {
                  points.push({
                    price: usdcIn / tokensOut,
                    type: "buy",
                    blockNumber: log.block_number || 0,
                    timestamp: log.timestamp ? new Date(log.timestamp).getTime() / 1000 : undefined,
                  });
                }
              }
            } catch {}
          }

          for (const log of sellLogs) {
            try {
              const parsed = bondingIface.parseLog({
                topics: log.topics,
                data: log.data,
              });
              if (parsed) {
                const tokensIn = parseFloat(ethers.formatEther(parsed.args.tokensIn));
                const usdcOut = parseFloat(ethers.formatEther(parsed.args.usdcOut));
                if (tokensIn > 0) {
                  points.push({
                    price: usdcOut / tokensIn,
                    type: "sell",
                    blockNumber: log.block_number || 0,
                    timestamp: log.timestamp ? new Date(log.timestamp).getTime() / 1000 : undefined,
                  });
                }
              }
            } catch {}
          }
        }

        // Fetch PostMigrationPool Swap events (after graduation)
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          const swapLogs = await fetchLogsFromArcscan(poolAddress, SWAP_TOPIC);

          for (const log of swapLogs) {
            try {
              const parsed = poolIface.parseLog({
                topics: log.topics,
                data: log.data,
              });
              if (parsed) {
                const tokenIn = parsed.args.tokenIn;
                const usdcIn = parsed.args.usdcIn;
                const tokenOut = parsed.args.tokenOut;
                const usdcOut = parsed.args.usdcOut;

                // Buy tokens: usdcIn > 0, tokenOut > 0
                if (usdcIn > 0n && tokenOut > 0n) {
                  const usdcF = parseFloat(ethers.formatEther(usdcIn));
                  const tokF = parseFloat(ethers.formatEther(tokenOut));
                  if (tokF > 0) {
                    points.push({
                      price: usdcF / tokF,
                      type: "buy",
                      blockNumber: log.block_number || 0,
                      timestamp: log.timestamp ? new Date(log.timestamp).getTime() / 1000 : undefined,
                    });
                  }
                }
                // Sell tokens: tokenIn > 0, usdcOut > 0
                else if (tokenIn > 0n && usdcOut > 0n) {
                  const tokF = parseFloat(ethers.formatEther(tokenIn));
                  const usdcF = parseFloat(ethers.formatEther(usdcOut));
                  if (tokF > 0) {
                    points.push({
                      price: usdcF / tokF,
                      type: "sell",
                      blockNumber: log.block_number || 0,
                      timestamp: log.timestamp ? new Date(log.timestamp).getTime() / 1000 : undefined,
                    });
                  }
                }
              }
            } catch {}
          }
        }

        // Sort by block number (or timestamp if available)
        points.sort((a, b) => {
          if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp;
          return a.blockNumber - b.blockNumber;
        });

        setTrades(points);
      } catch (err) {
        console.error("Failed to fetch trade data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
    // Re-fetch every 30 seconds
    const interval = setInterval(fetchTrades, 30000);
    return () => clearInterval(interval);
  }, [curveAddress, poolAddress]);

  // Build candles from trade points
  const candles = useMemo(() => {
    if (trades.length < 2) return [];
    const numCandles = Math.min(24, Math.max(4, Math.floor(trades.length / 2)));
    const candleSize = Math.ceil(trades.length / numCandles);
    const result: Candle[] = [];

    for (let i = 0; i < trades.length; i += candleSize) {
      const chunk = trades.slice(i, i + candleSize);
      if (chunk.length === 0) continue;
      const prices = chunk.map((t) => t.price);
      result.push({
        open: prices[0],
        close: prices[prices.length - 1],
        high: Math.max(...prices),
        low: Math.min(...prices),
      });
    }
    return result;
  }, [trades]);

  const chartH = 160;

  if (loading) {
    return (
      <div className="card-cartoon">
        <h3 className="font-display text-sm text-foreground mb-3">PRICE CHART</h3>
        <div className="flex items-center justify-center" style={{ height: chartH }}>
          <p className="text-xs text-muted-foreground font-body animate-pulse">
            Loading chart data...
          </p>
        </div>
      </div>
    );
  }

  // No trades — show current price with a visual
  if (candles.length === 0) {
    return (
      <div className="card-cartoon">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm text-foreground">PRICE CHART</h3>
          {graduated && (
            <span className="text-[10px] font-body text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              DEX
            </span>
          )}
        </div>
        <div className="relative w-full" style={{ height: chartH }}>
          <svg
            viewBox={`0 0 200 ${chartH}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1="0"
                y1={8 + pct * (chartH - 16)}
                x2="200"
                y2={8 + pct * (chartH - 16)}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.08}
                strokeDasharray="4 4"
              />
            ))}
            <line
              x1="10"
              y1={chartH / 2}
              x2="190"
              y2={chartH / 2}
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              strokeDasharray="6 3"
              strokeOpacity={0.6}
            />
            <circle cx="190" cy={chartH / 2} r={4} fill="hsl(var(--secondary))" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-display text-2xl text-foreground">
              ${currentPrice < 0.000001 ? currentPrice.toExponential(2) : currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)}
            </p>
            <p className="text-xs text-muted-foreground font-body mt-2">
              {trades.length === 0
                ? "No trades yet \u2014 be the first!"
                : `${trades.length} trade${trades.length > 1 ? "s" : ""} recorded`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render candles
  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const range = maxPrice - minPrice || minPrice * 0.01 || 0.000001;

  const yPos = (price: number) => chartH - ((price - minPrice) / range) * (chartH - 16) - 8;

  const priceChange =
    candles.length > 0
      ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
      : 0;

  return (
    <motion.div
      className="card-cartoon"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-sm text-foreground">PRICE CHART</h3>
          <span
            className={`text-xs font-body ${priceChange >= 0 ? "text-secondary" : "text-destructive"}`}
          >
            {priceChange >= 0 ? "+" : ""}
            {priceChange.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          {graduated && (
            <span className="text-[10px] font-body text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              DEX
            </span>
          )}
          <div className="flex gap-1">
            {["ALL"].map((t) => (
              <span
                key={t}
                onClick={() => setTimeframe(t)}
                className={`text-xs font-body px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                  t === timeframe
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full" style={{ height: chartH }}>
        <svg
          viewBox={`0 0 ${candles.length * 20} ${chartH}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <line
              key={pct}
              x1="0"
              y1={8 + pct * (chartH - 16)}
              x2={candles.length * 20}
              y2={8 + pct * (chartH - 16)}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.1}
              strokeDasharray="4 4"
            />
          ))}

          {candles.map((c, i) => {
            const isGreen = c.close >= c.open;
            const color = isGreen ? "hsl(var(--secondary))" : "hsl(var(--destructive))";
            const x = i * 20 + 10;
            const bodyTop = yPos(Math.max(c.open, c.close));
            const bodyBot = yPos(Math.min(c.open, c.close));
            const bodyH = Math.max(bodyBot - bodyTop, 1);

            return (
              <motion.g
                key={i}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: i * 0.02, duration: 0.3 }}
                style={{ transformOrigin: `${x}px ${chartH / 2}px` }}
              >
                <line
                  x1={x}
                  y1={yPos(c.high)}
                  x2={x}
                  y2={yPos(c.low)}
                  stroke={color}
                  strokeWidth={1.5}
                />
                <rect
                  x={x - 5}
                  y={bodyTop}
                  width={10}
                  height={bodyH}
                  rx={1.5}
                  fill={color}
                />
              </motion.g>
            );
          })}
        </svg>
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-xs text-muted-foreground font-body">
          {trades.length} trades
        </span>
        <span className="text-xs text-muted-foreground font-body">
          ${currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)}
        </span>
      </div>
    </motion.div>
  );
};

export default CandlestickChart;
