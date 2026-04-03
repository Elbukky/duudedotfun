import { motion } from "framer-motion";
import { useState } from "react";

const BuySellPanel = ({ tokenName, price }: { tokenName: string; price: number }) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');

  return (
    <div className="card-cartoon">
      <div className="flex rounded-xl overflow-hidden border-2 border-primary/30 mb-4">
        <motion.button
          className={`flex-1 py-3 font-display text-sm transition-colors ${mode === 'buy' ? "bg-secondary/20 text-secondary" : "text-muted-foreground"}`}
          onClick={() => setMode('buy')}
          whileTap={{ scale: 0.97 }}
        >
          BUY
        </motion.button>
        <motion.button
          className={`flex-1 py-3 font-display text-sm transition-colors ${mode === 'sell' ? "bg-destructive/20 text-destructive" : "text-muted-foreground"}`}
          onClick={() => setMode('sell')}
          whileTap={{ scale: 0.97 }}
        >
          SELL
        </motion.button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-body mb-1 block"><label className="text-xs text-muted-foreground font-body mb-1 block">Amount (USDC)</label></label>
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="flex gap-2">
          {['0.1', '0.5', '1', '5'].map((v) => (
            <motion.button
              key={v}
              onClick={() => setAmount(v)}
              className="flex-1 py-2 rounded-lg bg-muted border border-primary/20 text-xs font-body text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {v} USDC
            </motion.button>
          ))}
        </div>

        {amount && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-muted rounded-xl p-3 space-y-1"
          >
            <div className="flex justify-between text-xs font-body">
              <span className="text-muted-foreground">You get</span>
              <span className="text-foreground">{(parseFloat(amount || '0') / price).toLocaleString()} {tokenName}</span>
            </div>
            <div className="flex justify-between text-xs font-body">
              <span className="text-muted-foreground">Price impact</span>
              <span className="text-accent">~0.3%</span>
            </div>
          </motion.div>
        )}

        <motion.button
          className={`w-full btn-arcade py-3 text-sm ${mode === 'buy' ? "bg-secondary text-secondary-foreground border-secondary" : "bg-destructive text-destructive-foreground border-destructive"}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {mode === 'buy' ? '🚀 BUY' : '💰 SELL'} {tokenName}
        </motion.button>
      </div>
    </div>
  );
};

export default BuySellPanel;
