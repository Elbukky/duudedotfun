// Contract instance helpers
import { ethers } from "ethers";
import { ADDRESSES } from "@/contracts/addresses";
import TokenFactoryABI from "@/contracts/abis/TokenFactory.json";
import BondingCurveABI from "@/contracts/abis/BondingCurve.json";
import ArenaRegistryABI from "@/contracts/abis/ArenaRegistry.json";
import FeeVaultABI from "@/contracts/abis/FeeVault.json";
import LaunchTokenABI from "@/contracts/abis/LaunchToken.json";
import PostMigrationPoolABI from "@/contracts/abis/PostMigrationPool.json";
import PostMigrationFactoryABI from "@/contracts/abis/PostMigrationFactory.json";
import VestingVaultABI from "@/contracts/abis/VestingVault.json";

// Read-only contract instances (no signer needed)
export function getTokenFactory(provider: ethers.Provider) {
  return new ethers.Contract(ADDRESSES.TokenFactory, TokenFactoryABI, provider);
}

export function getBondingCurve(address: string, provider: ethers.Provider) {
  return new ethers.Contract(address, BondingCurveABI, provider);
}

export function getArenaRegistry(provider: ethers.Provider) {
  return new ethers.Contract(ADDRESSES.ArenaRegistry, ArenaRegistryABI, provider);
}

export function getFeeVault(provider: ethers.Provider) {
  return new ethers.Contract(ADDRESSES.FeeVault, FeeVaultABI, provider);
}

export function getLaunchToken(address: string, provider: ethers.Provider) {
  return new ethers.Contract(address, LaunchTokenABI, provider);
}

export function getPostMigrationPool(address: string, provider: ethers.Provider) {
  return new ethers.Contract(address, PostMigrationPoolABI, provider);
}

export function getPostMigrationFactory(provider: ethers.Provider) {
  return new ethers.Contract(ADDRESSES.PostMigrationFactory, PostMigrationFactoryABI, provider);
}

export function getVestingVault(address: string, provider: ethers.Provider) {
  return new ethers.Contract(address, VestingVaultABI, provider);
}

// Writable contract instances (needs signer)
export function getTokenFactoryWrite(signer: ethers.Signer) {
  return new ethers.Contract(ADDRESSES.TokenFactory, TokenFactoryABI, signer);
}

export function getBondingCurveWrite(address: string, signer: ethers.Signer) {
  return new ethers.Contract(address, BondingCurveABI, signer);
}

export function getPostMigrationPoolWrite(address: string, signer: ethers.Signer) {
  return new ethers.Contract(address, PostMigrationPoolABI, signer);
}

export function getLaunchTokenWrite(address: string, signer: ethers.Signer) {
  return new ethers.Contract(address, LaunchTokenABI, signer);
}

export function getFeeVaultWrite(signer: ethers.Signer) {
  return new ethers.Contract(ADDRESSES.FeeVault, FeeVaultABI, signer);
}

// Formatting helpers
export function formatUSDC(wei: bigint, decimals = 4): string {
  const formatted = ethers.formatEther(wei);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(decimals);
}

export function formatTokenAmount(wei: bigint, decimals = 2): string {
  const formatted = ethers.formatEther(wei);
  const num = parseFloat(formatted);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(decimals)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

/**
 * Format a price for display. For very small prices (< 0.000001),
 * uses the subscript-zero notation common on DEX UIs, e.g. "$0.0₅2393"
 * meaning 5 zeros after the decimal then "2393".
 */
export function formatPrice(wei: bigint): string {
  const num = parseFloat(ethers.formatEther(wei));
  if (num === 0) return "$0";
  if (num >= 1) return `$${num.toFixed(4)}`;
  if (num >= 0.01) return `$${num.toFixed(6)}`;
  if (num >= 0.000001) return `$${num.toFixed(8)}`;
  // Very small price — use subscript-zero notation: $0.0₅2393
  const str = num.toFixed(20);
  const afterDot = str.split(".")[1] || "";
  let leadingZeros = 0;
  for (const ch of afterDot) {
    if (ch === "0") leadingZeros++;
    else break;
  }
  const significant = afterDot.slice(leadingZeros, leadingZeros + 4);
  const subscriptDigits = "₀₁₂₃₄₅₆₇₈₉";
  const subscript = String(leadingZeros)
    .split("")
    .map((d) => subscriptDigits[parseInt(d)])
    .join("");
  return `$0.0${subscript}${significant}`;
}

/** Format a plain number price (not wei) using the same logic as formatPrice */
export function formatPriceNum(num: number): string {
  if (num === 0) return "$0";
  if (num >= 1) return `$${num.toFixed(4)}`;
  if (num >= 0.01) return `$${num.toFixed(6)}`;
  if (num >= 0.000001) return `$${num.toFixed(8)}`;
  const str = num.toFixed(20);
  const afterDot = str.split(".")[1] || "";
  let leadingZeros = 0;
  for (const ch of afterDot) {
    if (ch === "0") leadingZeros++;
    else break;
  }
  const significant = afterDot.slice(leadingZeros, leadingZeros + 4);
  const subscriptDigits = "₀₁₂₃₄₅₆₇₈₉";
  const subscript = String(leadingZeros)
    .split("")
    .map((d) => subscriptDigits[parseInt(d)])
    .join("");
  return `$0.0${subscript}${significant}`;
}

/** Format a plain number (not wei) with K/M/B abbreviations */
export function formatNumber(num: number, decimals = 2): string {
  if (num === 0) return "0";
  if (num < 0) return `-${formatNumber(-num, decimals)}`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(decimals)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
  if (num < 0.01) return num.toFixed(6);
  return num.toFixed(decimals);
}

// Token record type matching the contract struct
export interface TokenRecord {
  token: string;
  curve: string;
  vestingVault: string;
  creator: string;
  referrer: string;
  name: string;
  symbol: string;
  description: string;
  imageURI: string;
  links: {
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
    extra: string;
  };
  createdAt: bigint;
  graduated: boolean;
  migrationPool: string;
}

// Arena metrics type
export interface ArenaMetrics {
  totalBuyVolume: bigint;
  totalSellVolume: bigint;
  buyCount: bigint;
  sellCount: bigint;
  uniqueBuyerCount: bigint;
  holderCount: bigint;
  retainedBuyers: bigint;
  buyPressureBps: bigint;
  percentCompleteBps: bigint;
}

/**
 * Unified score formula (0-100). Used on homepage, token detail, and arena.
 * Mirrors the on-chain ArenaRegistry formula, normalized with activity damping.
 *
 * Raw formula:
 *   (retainedBuyers*300) + (uniqueBuyers*100) + (buyVolumeUSDC/1e18) +
 *   (buyPressureBps*10) + (holderCount*50) + (percentCompleteBps*5)
 *
 * Then: adjusted = rawScore * min(totalTrades/10, 1)
 * Normalized to 0-100 against a 150K ceiling.
 * Graduated tokens (percentCompleteBps >= 10000) get a floor of 50.
 */
export function computeScore(metrics: {
  retainedBuyers: bigint | number;
  uniqueBuyerCount: bigint | number;
  totalBuyVolume: bigint | number;
  buyPressureBps: bigint | number;
  holderCount: bigint | number;
  percentCompleteBps: bigint | number;
  buyCount: bigint | number;
  sellCount: bigint | number;
}): number {
  const retainedBuyers = Number(metrics.retainedBuyers);
  const uniqueBuyers = Number(metrics.uniqueBuyerCount);
  const buyPressureBps = Number(metrics.buyPressureBps);
  const holderCount = Number(metrics.holderCount);
  const percentCompleteBps = Number(metrics.percentCompleteBps);
  const buyCount = Number(metrics.buyCount);
  const sellCount = Number(metrics.sellCount);

  // Buy volume in USDC (whole units). Accept both bigint (wei) and number.
  const buyVolumeUSDC =
    typeof metrics.totalBuyVolume === "bigint"
      ? Number(metrics.totalBuyVolume / 10n ** 18n)
      : metrics.totalBuyVolume;

  // On-chain raw score formula
  const rawScore =
    retainedBuyers * 300 +
    uniqueBuyers * 100 +
    buyVolumeUSDC +
    buyPressureBps * 10 +
    holderCount * 50 +
    percentCompleteBps * 5;

  if (rawScore === 0) return 0;

  const totalTrades = buyCount + sellCount;
  const isGraduated = percentCompleteBps >= 10000;
  const activityMultiplier = Math.min(totalTrades / 10, 1);
  const adjusted = rawScore * activityMultiplier;

  const SCORE_NORMALIZATION_MAX = 150_000;
  let normalized = Math.round((adjusted * 100) / SCORE_NORMALIZATION_MAX);

  if (isGraduated) normalized = Math.max(normalized, 50);

  return Math.min(100, Math.max(1, normalized));
}

// Battle type
export interface BattleParticipant {
  token: string;
  curve: string;
  creator: string;
}

export interface Battle {
  startTime: bigint;
  endTime: bigint;
  resolved: boolean;
  winner: string;
}
