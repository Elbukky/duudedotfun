import { ethers } from "ethers";
import type { EnrichedToken } from "@/lib/tokenDataProvider";
import { computeScore } from "@/lib/contracts";

// ---------- Creator name localStorage helpers ----------
// Stored as: creator-name-{lowerCaseAddress} → string
export function getCreatorName(address: string): string {
  try {
    return localStorage.getItem(`creator-name-${address.toLowerCase()}`) || "";
  } catch {
    return "";
  }
}

export function setCreatorName(address: string, name: string): void {
  try {
    localStorage.setItem(`creator-name-${address.toLowerCase()}`, name.trim());
  } catch {}
}

/** Returns the saved creator name if any, otherwise shortAddress fallback */
export function resolveCreatorDisplayName(address: string): string {
  const name = getCreatorName(address);
  if (name) return name;
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export interface Token {
  id: string; // token contract address
  name: string;
  ticker: string;
  logo: string; // imageURI or emoji fallback
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  hypeScore: number;
  bondingProgress: number;
  category: string;
  creatorId: string;
  creatorName: string;
  lore: string;
  launchedAt: string;
  arenaRank: number;
  status: 'fighting' | 'mooning' | 'new' | 'hot' | 'graduated';
  // On-chain fields
  curveAddress?: string;
  vestingVault?: string;
  migrationPool?: string;
  links?: {
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
  };
  realUSDCRaised?: number;
  uniqueBuyers?: number;
  buyCount?: number;
  sellCount?: number;
  totalBuyVolume?: number;
  totalSellVolume?: number;
}

export interface Creator {
  id: string;
  name: string;
  avatar: string;
  reputation: number;
  launches: number;
  wins: number;
  graduated: number;
  totalHolders: number;
  badges: string[];
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  reward: string;
  icon: string;
}

export interface Activity {
  id: string;
  type: 'buy' | 'sell' | 'holder' | 'mission';
  user: string;
  amount?: number;
  message: string;
  timestamp: string;
  txHash?: string;
}

// Convert on-chain EnrichedToken to display Token
export function enrichedToToken(e: EnrichedToken, rank: number = 0): Token {
  // Use pool spot price for graduated tokens, otherwise bonding curve price
  const effectivePrice = (e.record.graduated && e.poolSpotPrice > 0n) ? e.poolSpotPrice : e.spotPrice;
  const price = parseFloat(ethers.formatEther(effectivePrice));
  const raised = parseFloat(ethers.formatEther(e.realUSDCRaised));
  const buyVol = parseFloat(ethers.formatEther(e.totalBuyVolume));
  const sellVol = parseFloat(ethers.formatEther(e.totalSellVolume));
  const poolVol = parseFloat(ethers.formatEther(e.postMigrationVolume));
  const holders = Number(e.holderCount);
  const bondingBps = Number(e.bondingProgressBps);
  const bondingPct = bondingBps / 100; // bps to percentage
  const uniqueBuyers = Number(e.uniqueBuyerCount);

  // Compute hype score: unified formula (same as arena)
  const hypeScore = computeScore({
    retainedBuyers: e.retainedBuyers,
    uniqueBuyerCount: e.uniqueBuyerCount,
    totalBuyVolume: e.totalBuyVolume,
    buyPressureBps: e.buyPressureBps,
    holderCount: e.holderCount,
    percentCompleteBps: e.bondingProgressBps,
    buyCount: e.buyCount,
    sellCount: e.sellCount,
  });

  // Determine status
  let status: Token['status'] = 'new';
  if (e.record.graduated) status = 'graduated';
  else if (bondingPct >= 80) status = 'mooning';
  else if (bondingPct >= 40) status = 'hot';
  else if (buyVol > 10) status = 'fighting';

  // Time ago
  const createdSec = Number(e.record.createdAt);
  const now = Math.floor(Date.now() / 1000);
  const diffMin = Math.floor((now - createdSec) / 60);
  let launchedAt = `${diffMin}m ago`;
  if (diffMin >= 60) {
    const diffH = Math.floor(diffMin / 60);
    launchedAt = diffH >= 24 ? `${Math.floor(diffH / 24)}d ago` : `${diffH}h ago`;
  }

  // Resolve logo: on-chain imageURI > localStorage fallback > "?"
  let logo = e.record.imageURI || "";
  if (!logo) {
    try {
      logo = localStorage.getItem(`token-image-${e.record.token.toLowerCase()}`) || "";
    } catch {}
  }
  if (!logo) logo = "?";

  return {
    id: e.record.token,
    name: e.record.name,
    ticker: e.record.symbol,
    logo,
    price,
    priceChange24h: 0, // Need historical data for this
    marketCap: price * 100_000_000_000, // spotPrice * totalSupply
    volume24h: buyVol + sellVol + poolVol,
    holders,
    hypeScore,
    bondingProgress: bondingPct,
    category: e.record.links?.extra || "Degen",
    creatorId: e.record.creator,
    creatorName: resolveCreatorDisplayName(e.record.creator),
    lore: e.record.description,
    launchedAt,
    arenaRank: rank,
    status,
    curveAddress: e.record.curve,
    vestingVault: e.record.vestingVault,
    migrationPool: e.record.migrationPool,
    links: e.record.links ? {
      website: e.record.links.website,
      twitter: e.record.links.twitter,
      telegram: e.record.links.telegram,
      discord: e.record.links.discord,
    } : undefined,
    realUSDCRaised: raised,
    uniqueBuyers,
    buyCount: Number(e.buyCount),
    sellCount: Number(e.sellCount),
    totalBuyVolume: buyVol,
    totalSellVolume: sellVol,
  };
}

export const categories = ['All', 'Animal', 'AI', 'Chaos', 'Politics', 'Degen', 'Food', 'Celebrity'];

// Mock missions (will be replaced with on-chain data later)
export const mockMissions: Mission[] = [
  { id: '1', title: 'First Blood', description: 'Reach 25 holders', progress: 0, target: 25, completed: false, reward: 'Bronze Badge', icon: '' },
  { id: '2', title: 'Century Club', description: 'Hit 100 buys', progress: 0, target: 100, completed: false, reward: 'Silver Badge', icon: '' },
  { id: '3', title: 'Survivor', description: 'Survive 24 hours', progress: 0, target: 24, completed: false, reward: 'Shield Badge', icon: '' },
  { id: '4', title: 'Volume Monster', description: 'Reach $50K volume', progress: 0, target: 50000, completed: false, reward: 'Diamond Badge', icon: '' },
  { id: '5', title: 'Community Power', description: 'Get 500 holders', progress: 0, target: 500, completed: false, reward: 'Crown Badge', icon: '' },
];
