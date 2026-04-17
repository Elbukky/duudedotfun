import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import mascot from "@/assets/mascot.png";

interface BondingProgressBarProps {
  progress: number;
  graduated?: boolean;
  barHeight?: string;
  mascotSize?: number;
  animDelay?: number;
  showGraduationAnim?: boolean;
}

/**
 * Animated bonding curve progress bar.
 *
 * - The mascot rides the leading edge of the fill, bobbing as if flying.
 * - On graduation (100 %), the mascot launches out of the bar in an
 *   upward curve — a one-time celebration animation.
 */
export default function BondingProgressBar({
  progress,
  graduated = false,
  barHeight = "",
  mascotSize = 28,
  animDelay = 0,
  showGraduationAnim = false,
}: BondingProgressBarProps) {
  const pct = Math.min(graduated ? 100 : progress, 100);
  const half = mascotSize / 2;

  // ── graduation fly-out state ──
  const [flyout, setFlyout] = useState(false);
  const didAnimate = useRef(false);

  // Trigger the fly-out once when the bar hits 100 %
  useEffect(() => {
    if (
      showGraduationAnim &&
      (graduated || progress >= 100) &&
      !didAnimate.current
    ) {
      didAnimate.current = true;
      // Wait for the fill animation to finish first
      const t = setTimeout(() => setFlyout(true), animDelay * 1000 + 1600);
      return () => clearTimeout(t);
    }
  }, [graduated, progress, showGraduationAnim, animDelay]);

  // Auto-hide the fly-out after it plays
  useEffect(() => {
    if (!flyout) return;
    const t = setTimeout(() => setFlyout(false), 2200);
    return () => clearTimeout(t);
  }, [flyout]);

  return (
    <div className="relative">
      {/* ── track + fill ── */}
      <div className={`progress-arcade ${barHeight}`}>
        <motion.div
          className="progress-arcade-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, delay: animDelay }}
        />
      </div>

      {/* ── mascot flying at the leading edge ── */}
      {pct > 0 && !flyout && (
        <motion.div
          className="absolute z-10 pointer-events-none"
          style={{ top: "50%", marginTop: -half, marginLeft: -half }}
          initial={{ left: "0%", opacity: 0 }}
          animate={{ left: `${pct}%`, opacity: 1 }}
          transition={{
            left: { duration: 1.5, delay: animDelay, ease: "easeOut" },
            opacity: { duration: 0.4, delay: animDelay },
          }}
        >
          <motion.img
            src={mascot}
            alt=""
            draggable={false}
            style={{ width: mascotSize, height: mascotSize }}
            className="drop-shadow-[0_0_6px_hsl(var(--neon-purple)/0.6)]"
            animate={{ y: [-2, 3, -2], rotate: [-6, 8, -6] }}
            transition={{
              y: { repeat: Infinity, duration: 1.2, ease: "easeInOut" },
              rotate: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
            }}
          />
        </motion.div>
      )}

      {/* ── graduation fly-out: mascot curves upward ── */}
      {flyout && (
        <motion.div
          className="absolute z-20 pointer-events-none"
          style={{ right: -8, top: "50%", marginTop: -20 }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
          animate={{
            x: [0, 35, 60],
            y: [0, -80, -200],
            rotate: [0, -20, -50],
            scale: [1, 1.4, 0.3],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 1.8, ease: [0.22, 0.75, 0.25, 1] }}
        >
          <img src={mascot} alt="" className="w-10 h-10" draggable={false} />
        </motion.div>
      )}
    </div>
  );
}
