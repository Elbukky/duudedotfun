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
 * The mascot rides the leading edge of the fill with a lively multi-frequency
 * flying animation (bobbing, banking, breathing, speed-trail particles, and a
 * pulsing energy glow).
 *
 * On graduation the mascot launches upward in a curve with burst sparkles.
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
  // Keep the mascot away from the very edge so it never looks squeezed
  const mascotPct = Math.min(pct, 94);
  const half = mascotSize / 2;

  // ── graduation fly-out ──
  const [flyout, setFlyout] = useState(false);
  const didAnimate = useRef(false);

  useEffect(() => {
    if (
      showGraduationAnim &&
      (graduated || progress >= 100) &&
      !didAnimate.current
    ) {
      didAnimate.current = true;
      const t = setTimeout(() => setFlyout(true), animDelay * 1000 + 1600);
      return () => clearTimeout(t);
    }
  }, [graduated, progress, showGraduationAnim, animDelay]);

  useEffect(() => {
    if (!flyout) return;
    const t = setTimeout(() => setFlyout(false), 2800);
    return () => clearTimeout(t);
  }, [flyout]);

  // Pre-computed sparkle burst directions (upward fan)
  const sparkles = [
    { angle: -20, dist: 55 },
    { angle: -50, dist: 70 },
    { angle: -80, dist: 60 },
    { angle: -110, dist: 65 },
    { angle: -140, dist: 50 },
    { angle: -165, dist: 55 },
  ];

  return (
    <div className="relative" style={{ overflow: "visible" }}>
      {/* ── track + fill ── */}
      <div className={`progress-arcade ${barHeight}`}>
        <motion.div
          className="progress-arcade-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, delay: animDelay }}
        />
      </div>

      {/* ── flying mascot ── */}
      {pct > 0 && !flyout && (
        <motion.div
          className="absolute z-10 pointer-events-none"
          style={{ top: "50%", marginTop: -half, marginLeft: -half }}
          initial={{ left: "0%", opacity: 0 }}
          animate={{ left: `${mascotPct}%`, opacity: 1 }}
          transition={{
            left: { duration: 1.5, delay: animDelay, ease: "easeOut" },
            opacity: { duration: 0.4, delay: animDelay },
          }}
        >
          {/* Pulsing energy glow behind mascot */}
          <motion.div
            className="absolute rounded-full blur-md -z-10"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--neon-purple) / 0.5), hsl(var(--slime-green) / 0.15), transparent 70%)",
              width: mascotSize * 1.6,
              height: mascotSize * 1.6,
              left: -(mascotSize * 0.3),
              top: -(mascotSize * 0.3),
            }}
            animate={{
              opacity: [0.35, 0.8, 0.35],
              scale: [0.85, 1.25, 0.85],
            }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />

          {/* Speed-trail particles shooting backward */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 3 - i * 0.5,
                height: 3 - i * 0.5,
                top: half - 1.5,
                left: half,
                background: `hsl(var(--neon-purple) / ${0.7 - i * 0.15})`,
              }}
              animate={{
                x: [0, -(mascotSize * 0.6 + i * 10)],
                opacity: [0.7, 0],
                scale: [1, 0.2],
              }}
              transition={{
                repeat: Infinity,
                duration: 0.7 + i * 0.15,
                delay: i * 0.2,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Mascot image — multi-frequency animation keeps it lively */}
          <motion.img
            src={mascot}
            alt=""
            draggable={false}
            style={{ width: mascotSize, height: mascotSize }}
            className="relative z-10 drop-shadow-[0_0_8px_hsl(var(--neon-purple)/0.5)]"
            animate={{
              // 5-point keyframes + different durations = organic, never-repeating motion
              y: [-4, 6, -2, 5, -4],
              x: [-1, 3, 0, -2, -1],
              rotate: [-10, 16, -5, 13, -10],
              scale: [1, 1.09, 0.97, 1.06, 1],
            }}
            transition={{
              y: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
              x: { repeat: Infinity, duration: 2.6, ease: "easeInOut" },
              rotate: { repeat: Infinity, duration: 2.8, ease: "easeInOut" },
              scale: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
            }}
          />
        </motion.div>
      )}

      {/* ── graduation fly-out ── */}
      {flyout && (
        <>
          {/* Sparkle burst */}
          {sparkles.map(({ angle, dist }, i) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <motion.div
                key={`spark-${i}`}
                className="absolute z-20 pointer-events-none rounded-full"
                style={{
                  left: "88%",
                  top: "50%",
                  width: 5 - i * 0.3,
                  height: 5 - i * 0.3,
                  background:
                    i % 2 === 0
                      ? "hsl(var(--accent))"
                      : "hsl(var(--neon-purple))",
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(rad) * dist,
                  y: Math.sin(rad) * dist,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{
                  duration: 0.7,
                  delay: 0.05 + i * 0.04,
                  ease: "easeOut",
                }}
              />
            );
          })}

          {/* Mascot launching upward in a curve */}
          <motion.div
            className="absolute z-20 pointer-events-none"
            style={{ left: "86%", top: "50%", marginTop: -20, marginLeft: -20 }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
            animate={{
              x: [0, 50, 90],
              y: [0, -120, -300],
              rotate: [0, -25, -55],
              scale: [1, 1.5, 0.15],
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 2.0, ease: [0.22, 0.68, 0.18, 1] }}
          >
            <img src={mascot} alt="" className="w-10 h-10" draggable={false} />
          </motion.div>
        </>
      )}
    </div>
  );
}
