import { motion } from "framer-motion";
import { useMemo } from "react";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

const generateMockCandles = (basePrice: number): Candle[] => {
  const candles: Candle[] = [];
  let price = basePrice * 0.6;
  const hours = ["12AM","2AM","4AM","6AM","8AM","10AM","12PM","2PM","4PM","6PM","8PM","10PM","Now"];
  
  for (let i = 0; i < 24; i++) {
    const open = price;
    const change = (Math.random() - 0.45) * price * 0.15;
    const close = Math.max(open + change, 0.000001);
    const high = Math.max(open, close) * (1 + Math.random() * 0.05);
    const low = Math.min(open, close) * (1 - Math.random() * 0.05);
    candles.push({
      time: hours[Math.floor(i / 2)] || "",
      open,
      high,
      low,
      close,
    });
    price = close;
  }
  return candles;
};

const CandlestickChart = ({ basePrice }: { basePrice: number }) => {
  const candles = useMemo(() => generateMockCandles(basePrice), [basePrice]);

  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const range = maxPrice - minPrice || 1;

  const chartW = 100; // percentage
  const chartH = 160;
  const candleW = chartW / candles.length;

  const yPos = (price: number) => chartH - ((price - minPrice) / range) * (chartH - 16) - 8;

  return (
    <motion.div
      className="card-cartoon"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm text-foreground">📈 PRICE CHART (24H)</h3>
        <div className="flex gap-2">
          {["1H", "4H", "24H"].map((t) => (
            <span
              key={t}
              className={`text-xs font-body px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                t === "24H"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </span>
          ))}
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
                {/* Wick */}
                <line
                  x1={x}
                  y1={yPos(c.high)}
                  x2={x}
                  y2={yPos(c.low)}
                  stroke={color}
                  strokeWidth={1.5}
                />
                {/* Body */}
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
        <span className="text-xs text-muted-foreground font-body">24h ago</span>
        <span className="text-xs text-muted-foreground font-body">Now</span>
      </div>
    </motion.div>
  );
};

export default CandlestickChart;
