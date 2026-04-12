import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import { ethers } from "ethers";

interface TradePoint {
  price: number;
  type: "buy" | "sell";
  blockNumber: number;
  timestamp: number;
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  buyCount: number;
  sellCount: number;
}

interface CandlestickChartProps {
  curveAddress: string | null;
  poolAddress?: string | null;
  currentPrice: number;
  graduated?: boolean;
}

// Arcscan (Blockscout v2) API for fetching logs
const ARCSCAN_BASE = "https://testnet.arcscan.app/api/v2";

// Event topic0 hashes
const BUY_TOPIC = ethers.id("Buy(address,address,uint256,uint256,uint256)");
const SELL_TOPIC = ethers.id("Sell(address,uint256,uint256,uint256)");
const SWAP_TOPIC = ethers.id("Swap(address,address,uint256,uint256,uint256,uint256)");

// ABIs for decoding log data
const BONDING_EVENTS = [
  "event Buy(address indexed buyer, address indexed recipient, uint256 usdcIn, uint256 tokensOut, uint256 fee)",
  "event Sell(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee)",
];
const POOL_EVENTS = [
  "event Swap(address indexed sender, address indexed to, uint256 tokenIn, uint256 usdcIn, uint256 tokenOut, uint256 usdcOut)",
];

/**
 * Fetch ALL logs for a contract address from Arcscan.
 * The Arcscan API does NOT support ?topic0= filtering (returns 422),
 * so we fetch everything and filter client-side.
 */
async function fetchAllLogs(contractAddress: string): Promise<any[]> {
  try {
    const res = await fetch(`${ARCSCAN_BASE}/addresses/${contractAddress}/logs`);
    if (!res.ok) {
      console.warn(`Arcscan logs fetch failed: ${res.status} for ${contractAddress}`);
      return [];
    }
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.warn("Arcscan fetch error:", err);
    return [];
  }
}

/** Filter null entries from topics array (Arcscan pads with nulls) */
function cleanTopics(topics: (string | null)[]): string[] {
  return topics.filter((t): t is string => t != null);
}

// Fixed viewBox dimensions
const VB_WIDTH = 500;
const VB_HEIGHT = 200;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 24;
const PADDING_LEFT = 10;
const PADDING_RIGHT = 10;
const CHART_WIDTH = VB_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = VB_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const CandlestickChart = ({
  curveAddress,
  poolAddress,
  currentPrice,
  graduated = false,
}: CandlestickChartProps) => {
  const [trades, setTrades] = useState<TradePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("ALL");
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);

  // Fetch trade events from Arcscan API
  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      const points: TradePoint[] = [];

      try {
        const bondingIface = new ethers.Interface(BONDING_EVENTS);
        const poolIface = new ethers.Interface(POOL_EVENTS);

        // Fetch ALL bonding curve logs (always, even after graduation for history)
        if (curveAddress) {
          const allLogs = await fetchAllLogs(curveAddress);

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
                  if (tokensOut > 0) {
                    points.push({
                      price: usdcIn / tokensOut,
                      type: "buy",
                      blockNumber: log.block_number || 0,
                      timestamp: log.block_timestamp
                        ? new Date(log.block_timestamp).getTime() / 1000
                        : 0,
                    });
                  }
                }
              } else if (topic0 === SELL_TOPIC.toLowerCase()) {
                const parsed = bondingIface.parseLog({ topics, data: log.data });
                if (parsed) {
                  const tokensIn = parseFloat(ethers.formatEther(parsed.args.tokensIn));
                  const usdcOut = parseFloat(ethers.formatEther(parsed.args.usdcOut));
                  if (tokensIn > 0) {
                    points.push({
                      price: usdcOut / tokensIn,
                      type: "sell",
                      blockNumber: log.block_number || 0,
                      timestamp: log.block_timestamp
                        ? new Date(log.block_timestamp).getTime() / 1000
                        : 0,
                    });
                  }
                }
              }
            } catch {
              // Skip unparseable logs
            }
          }
        }

        // Fetch PostMigrationPool Swap events (after graduation)
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          const allPoolLogs = await fetchAllLogs(poolAddress);

          for (const log of allPoolLogs) {
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
                if (tokF > 0) {
                  points.push({
                    price: usdcF / tokF,
                    type: "buy",
                    blockNumber: log.block_number || 0,
                    timestamp: log.block_timestamp
                      ? new Date(log.block_timestamp).getTime() / 1000
                      : 0,
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

        // Sort by timestamp (primary) or block number (fallback)
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
    const numCandles = Math.min(30, Math.max(4, Math.floor(trades.length / 2)));
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
        buyCount: chunk.filter((t) => t.type === "buy").length,
        sellCount: chunk.filter((t) => t.type === "sell").length,
      });
    }
    return result;
  }, [trades]);

  // Helper: format price for display
  const fmtPrice = (p: number) => {
    if (p === 0) return "$0";
    if (p < 0.000001) return `$${p.toExponential(2)}`;
    if (p < 0.01) return `$${p.toFixed(8)}`;
    if (p < 1) return `$${p.toFixed(6)}`;
    return `$${p.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className="card-cartoon">
        <h3 className="font-display text-sm text-foreground mb-3">PRICE CHART</h3>
        <div className="flex items-center justify-center" style={{ height: 200 }}>
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
        <div className="relative w-full" style={{ height: 200 }}>
          <svg
            viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
            className="w-full h-full"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1={PADDING_LEFT}
                y1={PADDING_TOP + pct * CHART_HEIGHT}
                x2={VB_WIDTH - PADDING_RIGHT}
                y2={PADDING_TOP + pct * CHART_HEIGHT}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.08}
                strokeDasharray="4 4"
              />
            ))}
            <line
              x1={PADDING_LEFT + 20}
              y1={PADDING_TOP + CHART_HEIGHT / 2}
              x2={VB_WIDTH - PADDING_RIGHT - 20}
              y2={PADDING_TOP + CHART_HEIGHT / 2}
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              strokeDasharray="6 3"
              strokeOpacity={0.6}
            />
            <circle
              cx={VB_WIDTH - PADDING_RIGHT - 20}
              cy={PADDING_TOP + CHART_HEIGHT / 2}
              r={4}
              fill="hsl(var(--secondary))"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-display text-2xl text-foreground">
              {fmtPrice(currentPrice)}
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

  // Render candles with fixed viewBox
  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  // Add 5% padding to price range so candles don't touch edges
  const pricePad = (maxPrice - minPrice) * 0.05 || minPrice * 0.01 || 0.000001;
  const rangeMin = minPrice - pricePad;
  const rangeMax = maxPrice + pricePad;
  const range = rangeMax - rangeMin;

  // Map price to Y coordinate within the chart area
  const yPos = (price: number) =>
    PADDING_TOP + CHART_HEIGHT - ((price - rangeMin) / range) * CHART_HEIGHT;

  // Calculate candle spacing within fixed viewBox
  const totalCandles = candles.length;
  const candleSpacing = CHART_WIDTH / totalCandles;
  const candleWidth = Math.min(16, Math.max(4, candleSpacing * 0.6));

  const priceChange =
    ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100;

  // Generate Y-axis price labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    price: rangeMax - pct * range,
    y: PADDING_TOP + pct * CHART_HEIGHT,
  }));

  // Tooltip info for hovered candle
  const hoveredInfo = hoveredCandle !== null ? candles[hoveredCandle] : null;

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

      {/* Tooltip */}
      {hoveredInfo && (
        <div className="flex items-center gap-4 mb-1 text-[10px] font-body text-muted-foreground">
          <span>O: {fmtPrice(hoveredInfo.open)}</span>
          <span>H: {fmtPrice(hoveredInfo.high)}</span>
          <span>L: {fmtPrice(hoveredInfo.low)}</span>
          <span>C: {fmtPrice(hoveredInfo.close)}</span>
          <span className="text-secondary">{hoveredInfo.buyCount} buys</span>
          <span className="text-destructive">{hoveredInfo.sellCount} sells</span>
        </div>
      )}

      <div className="relative w-full" style={{ height: 200 }}>
        <svg
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          {/* Grid lines */}
          {yLabels.map((label, i) => (
            <g key={i}>
              <line
                x1={PADDING_LEFT}
                y1={label.y}
                x2={VB_WIDTH - PADDING_RIGHT}
                y2={label.y}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.1}
                strokeDasharray="4 4"
              />
            </g>
          ))}

          {/* Candles */}
          {candles.map((c, i) => {
            const isGreen = c.close >= c.open;
            const color = isGreen ? "hsl(var(--secondary))" : "hsl(var(--destructive))";
            const x = PADDING_LEFT + candleSpacing * i + candleSpacing / 2;
            const wickTop = yPos(c.high);
            const wickBot = yPos(c.low);
            const bodyTop = yPos(Math.max(c.open, c.close));
            const bodyBot = yPos(Math.min(c.open, c.close));
            const bodyH = Math.max(bodyBot - bodyTop, 1.5);
            const isHovered = hoveredCandle === i;

            return (
              <motion.g
                key={i}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: i * 0.015, duration: 0.3 }}
                style={{ transformOrigin: `${x}px ${(wickTop + wickBot) / 2}px` }}
                onMouseEnter={() => setHoveredCandle(i)}
                onMouseLeave={() => setHoveredCandle(null)}
                className="cursor-crosshair"
              >
                {/* Hover highlight */}
                {isHovered && (
                  <rect
                    x={x - candleSpacing / 2}
                    y={PADDING_TOP}
                    width={candleSpacing}
                    height={CHART_HEIGHT}
                    fill="hsl(var(--foreground))"
                    fillOpacity={0.03}
                  />
                )}

                {/* Wick (high-low line) */}
                <line
                  x1={x}
                  y1={wickTop}
                  x2={x}
                  y2={wickBot}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />

                {/* Body (open-close rectangle) */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyH}
                  rx={1}
                  fill={color}
                  stroke={isHovered ? "hsl(var(--foreground))" : "none"}
                  strokeWidth={0.5}
                />
              </motion.g>
            );
          })}

          {/* Current price line */}
          {currentPrice > 0 && currentPrice >= rangeMin && currentPrice <= rangeMax && (
            <g>
              <line
                x1={PADDING_LEFT}
                y1={yPos(currentPrice)}
                x2={VB_WIDTH - PADDING_RIGHT}
                y2={yPos(currentPrice)}
                stroke="hsl(var(--primary))"
                strokeWidth={0.8}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
              <rect
                x={VB_WIDTH - PADDING_RIGHT - 2}
                y={yPos(currentPrice) - 6}
                width={4}
                height={12}
                rx={2}
                fill="hsl(var(--primary))"
                fillOpacity={0.8}
              />
            </g>
          )}
        </svg>
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-xs text-muted-foreground font-body">
          {trades.length} trades · {candles.length} candles
        </span>
        <span className="text-xs text-muted-foreground font-body">
          {fmtPrice(currentPrice)}
        </span>
      </div>
    </motion.div>
  );
};

export default CandlestickChart;
