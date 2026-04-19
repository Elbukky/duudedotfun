import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import mascot from "@/assets/mascot.png";
import pepeAstronaut from "@/assets/pepe-astronaut.png";

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
 * The mascot rides the leading edge of the fill with a gentle bobbing animation.
 * Small floating astronauts drift inside the filled portion.
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

  // Floating astronaut positions inside the fill
  const astronauts = [
    { left: "12%", delay: 0 },
    { left: "38%", delay: 0.5 },
    { left: "62%", delay: 1.0 },
    { left: "85%", delay: 1.5 },
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
        >
          {/* Small floating astronauts inside the fill */}
          {astronauts.map((astro, i) => (
            <motion.img
              key={`astro-${i}`}
              src={pepeAstronaut}
              alt=""
              draggable={false}
              className="absolute pointer-events-none"
              style={{
                width: 12,
                height: 12,
                left: astro.left,
                top: "50%",
                marginTop: -6,
                opacity: 0.55,
              }}
              animate={{
                y: [-2, 2, -2],
                rotate: [-8, 8, -8],
              }}
              transition={{
                y: {
                  repeat: Infinity,
                  duration: 2.5 + i * 0.3,
                  delay: astro.delay,
                  ease: "easeInOut",
                },
                rotate: {
                  repeat: Infinity,
                  duration: 3 + i * 0.4,
                  delay: astro.delay,
                  ease: "easeInOut",
                },
              }}
            />
          ))}
        </motion.div>
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
          {/* Subtle glow behind mascot */}
          <motion.div
            className="absolute rounded-full blur-md -z-10"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--neon-purple) / 0.3), transparent 70%)",
              width: mascotSize * 1.4,
              height: mascotSize * 1.4,
              left: -(mascotSize * 0.2),
              top: -(mascotSize * 0.2),
            }}
            animate={{
              opacity: [0.3, 0.55, 0.3],
              scale: [0.95, 1.08, 0.95],
            }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />

          {/* Mascot image — continuous subtle shake */}
          <motion.img
            src={mascot}
            alt=""
            draggable={false}
            style={{ width: mascotSize, height: mascotSize }}
            className="relative z-10 drop-shadow-[0_0_6px_hsl(var(--neon-purple)/0.4)]"
            animate={{
              x: [-0.8, 0.8, -0.5, 0.6, -0.8],
              y: [-1, 1.2, -0.6, 1, -1],
              rotate: [-2, 2.5, -1.5, 2, -2],
              scale: [1, 1.015, 0.99, 1.01, 1],
            }}
            transition={{
              x: { repeat: Infinity, duration: 0.4, ease: "easeInOut" },
              y: { repeat: Infinity, duration: 0.5, ease: "easeInOut" },
              rotate: { repeat: Infinity, duration: 0.6, ease: "easeInOut" },
              scale: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
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
