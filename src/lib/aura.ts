import type { Token } from "./mockData";

export type AuraType = "PUMPING" | "GROWING" | "VOLATILE" | "DANGER" | "EARLY_GEM" | "KING";

export interface AuraState {
  type: AuraType;
  intensity: "LOW" | "MEDIUM" | "HIGH";
  label: string;
  tooltip: string;
}

const AURA_CONFIG: Record<AuraType, {
  colors: [string, string]; // gradient stops as HSL
  label: string;
}> = {
  PUMPING: {
    colors: ["0 80% 55%", "30 100% 55%"],
    label: "🔥 Pumping",
  },
  GROWING: {
    colors: ["120 70% 50%", "150 60% 45%"],
    label: "📈 Growing",
  },
  VOLATILE: {
    colors: ["50 100% 55%", "270 80% 60%"],
    label: "⚡ Volatile",
  },
  DANGER: {
    colors: ["0 80% 50%", "0 60% 35%"],
    label: "⚠️ Danger",
  },
  EARLY_GEM: {
    colors: ["45 100% 55%", "35 80% 40%"],
    label: "💎 Early Gem",
  },
  KING: {
    colors: ["45 100% 55%", "270 80% 60%"],
    label: "👑 King",
  },
};

export function getAuraState(token: Token, rank?: number): AuraState {
  const { priceChange24h, bondingProgress, volume24h, marketCap, hypeScore } = token;

  let type: AuraType;
  let tooltip: string;

  // KING: top rank or highest hype
  if (rank !== undefined && rank <= 3) {
    type = "KING";
    tooltip = `Top #${rank} — Dominating the arena`;
  }
  // DANGER: heavy sell pressure
  else if (priceChange24h < -10) {
    type = "DANGER";
    tooltip = `${priceChange24h.toFixed(1)}% — Sell pressure detected`;
  }
  // PUMPING: high buy pressure + rapid price increase
  else if (priceChange24h > 100 && volume24h > 50000) {
    type = "PUMPING";
    tooltip = `+${priceChange24h.toFixed(0)}% — Massive buy pressure`;
  }
  // EARLY_GEM: low mcap + early bonding
  else if (marketCap < 100000 && bondingProgress < 30) {
    type = "EARLY_GEM";
    tooltip = `Low cap gem — ${bondingProgress}% bonded`;
  }
  // VOLATILE: high fluctuation signals
  else if (Math.abs(priceChange24h) > 50 && volume24h > 30000) {
    type = "VOLATILE";
    tooltip = `High volatility — ${priceChange24h > 0 ? "+" : ""}${priceChange24h.toFixed(0)}%`;
  }
  // GROWING: steady upward
  else {
    type = "GROWING";
    tooltip = `Steady growth — Hype ${hypeScore}`;
  }

  // Intensity based on composite score
  const score =
    Math.min(Math.abs(priceChange24h) / 100, 1) * 0.3 +
    Math.min(volume24h / 100000, 1) * 0.3 +
    (bondingProgress / 100) * 0.2 +
    (hypeScore / 100) * 0.2;

  const intensity: AuraState["intensity"] =
    score > 0.65 ? "HIGH" : score > 0.35 ? "MEDIUM" : "LOW";

  return {
    type,
    intensity,
    label: AURA_CONFIG[type].label,
    tooltip,
  };
}

export function getAuraColors(type: AuraType): [string, string] {
  return AURA_CONFIG[type].colors;
}

export function getAuraOpacity(intensity: AuraState["intensity"]): number {
  switch (intensity) {
    case "HIGH": return 0.6;
    case "MEDIUM": return 0.35;
    case "LOW": return 0.15;
  }
}

export function getAuraAnimationDuration(intensity: AuraState["intensity"]): number {
  switch (intensity) {
    case "HIGH": return 1.5;
    case "MEDIUM": return 2.5;
    case "LOW": return 4;
  }
}
