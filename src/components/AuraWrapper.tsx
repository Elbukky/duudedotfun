import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Token } from "@/lib/mockData";
import { getAuraState, getAuraColors, getAuraOpacity, getAuraAnimationDuration } from "@/lib/aura";

interface AuraWrapperProps {
  token: Token;
  rank?: number;
  children: React.ReactNode;
  className?: string;
  /** Stronger aura for detail pages */
  enhanced?: boolean;
}

const AuraWrapper = memo(({ token, rank, children, className = "", enhanced = false }: AuraWrapperProps) => {
  const [hovered, setHovered] = useState(false);

  const aura = useMemo(() => getAuraState(token, rank), [token, rank]);
  const [color1, color2] = useMemo(() => getAuraColors(aura.type), [aura.type]);
  const baseOpacity = getAuraOpacity(aura.intensity);
  const duration = getAuraAnimationDuration(aura.intensity);

  const opacity = hovered ? Math.min(baseOpacity * 1.6, 0.85) : baseOpacity;
  const spread = enhanced ? "-6px" : hovered ? "-4px" : "-2px";
  const blur = enhanced ? "12px" : hovered ? "10px" : "6px";

  const isJitter = aura.type === "VOLATILE";
  const isGlitch = aura.type === "DANGER";
  const isSparkle = aura.type === "EARLY_GEM" || aura.type === "KING";

  return (
    <motion.div
      className={`relative ${className}`}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: enhanced ? 1 : 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Aura glow layer */}
      <motion.div
        className="absolute rounded-2xl pointer-events-none"
        style={{
          inset: spread,
          zIndex: 0,
          background: `linear-gradient(135deg, hsl(${color1} / ${opacity}), hsl(${color2} / ${opacity * 0.7}))`,
          filter: `blur(${blur})`,
        }}
        animate={
          isJitter
            ? { opacity: [opacity, opacity * 0.5, opacity, opacity * 0.7, opacity], x: [-1, 1, -1, 0] }
            : isGlitch
            ? { opacity: [opacity, opacity * 0.3, opacity, opacity * 0.6, opacity] }
            : isSparkle
            ? { opacity: [opacity * 0.8, opacity, opacity * 0.9, opacity, opacity * 0.8], scale: [1, 1.02, 1, 1.01, 1] }
            : { opacity: [opacity * 0.7, opacity, opacity * 0.7] }
        }
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Animated border overlay — uses inset box-shadow (respects borderRadius) */}
      <motion.div
        className="absolute rounded-2xl pointer-events-none"
        style={{
          inset: 0,
          zIndex: 1,
        }}
        animate={{
          boxShadow: [
            `inset 0 0 0 1.5px hsl(${color1} / ${opacity * 0.3})`,
            `inset 0 0 0 1.5px hsl(${color2} / ${opacity * 0.5})`,
            `inset 0 0 0 1.5px hsl(${color1} / ${opacity * 0.3})`,
          ],
        }}
        transition={{ duration: duration * 1.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Content */}
      <div className="relative" style={{ zIndex: 2 }}>
        {children}
      </div>

      {/* Aura label tooltip on hover */}
      {hovered && (
        <motion.div
          className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1 text-[10px] font-body text-foreground shadow-lg">
            <span className="mr-1.5">{aura.label}</span>
            <span className="text-muted-foreground">· {aura.tooltip}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
});

AuraWrapper.displayName = "AuraWrapper";

export default AuraWrapper;
