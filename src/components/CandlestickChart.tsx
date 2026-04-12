import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import { getBondingCurve } from "@/lib/contracts";

interface TradePoint {
  price: number;
  type: "buy" | "sell";
  blockNumber: number;
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

const BUY_EVENT = "event Buy(address indexed buyer, address indexed recipient, uint256 usdcIn, uint256 tokensOut, uint256 fee)";
const SELL_EVENT = "event Sell(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee)";

const CandlestickChart = ({ curveAddress, currentPrice, graduated = false }: CandlestickChartProps) => {
  const { readProvider } = useWeb3();
  const [trades, setTrades] = useState<TradePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("ALL");

  // Fetch trade events from the bonding curve contract
  useEffect(() => {
    if (!curveAddress) {
      setLoading(false);
      return;
    }

    const fetchTrades = async () => {
      setLoading(true);
      try {
        const iface = new ethers.Interface([BUY_EVENT, SELL_EVENT]);
        const curve = getBondingCurve(curveAddress, readProvider);

        // Query Buy and Sell events - use a wide block range
        const currentBlock = await readProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);

        const [buyLogs, sellLogs] = await Promise.all([
          curve.queryFilter(curve.filters.Buy(), fromBlock, currentBlock).catch(() => []),
          curve.queryFilter(curve.filters.Sell(), fromBlock, currentBlock).catch(() => []),
        ]);

        const points: TradePoint[] = [];

        for (const log of buyLogs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed) {
              const usdcIn = parseFloat(ethers.formatEther(parsed.args.usdcIn));
              const tokensOut = parseFloat(ethers.formatEther(parsed.args.tokensOut));
              if (tokensOut > 0) {
                points.push({
                  price: usdcIn / tokensOut,
                  type: "buy",
                  blockNumber: log.blockNumber,
                });
              }
            }
          } catch {}
        }

        for (const log of sellLogs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed) {
              const tokensIn = parseFloat(ethers.formatEther(parsed.args.tokensIn));
              const usdcOut = parseFloat(ethers.formatEther(parsed.args.usdcOut));
              if (tokensIn > 0) {
                points.push({
                  price: usdcOut / tokensIn,
                  type: "sell",
                  blockNumber: log.blockNumber,
                });
              }
            }
          } catch {}
        }

        // Sort by block number
        points.sort((a, b) => a.blockNumber - b.blockNumber);
        setTrades(points);
      } catch (err) {
        console.error("Failed to fetch trade data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, [curveAddress, readProvider]);

  // Build candles from trade points
  const candles = useMemo(() => {
    if (trades.length < 2) return [];

    // Group trades into N candles (max 24)
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

  // Chart dimensions
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

  // No trades - show current price
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
        <div
          className="flex flex-col items-center justify-center bg-muted/30 rounded-xl"
          style={{ height: chartH }}
        >
          <p className="font-display text-2xl text-foreground">
            ${currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)}
          </p>
          <p className="text-xs text-muted-foreground font-body mt-2">
            {trades.length === 0
              ? "No trades yet — be the first!"
              : "Current spot price"}
          </p>
          {trades.length === 1 && (
            <p className="text-xs text-muted-foreground font-body mt-1">
              1 trade recorded
            </p>
          )}
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

  const priceChange = candles.length > 0
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
          {/* Grid lines */}
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

      {/* Price labels */}
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
