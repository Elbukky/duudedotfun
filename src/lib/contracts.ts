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

export function formatPrice(wei: bigint): string {
  const num = parseFloat(ethers.formatEther(wei));
  if (num === 0) return "$0";
  if (num < 0.000001) return `$${num.toExponential(2)}`;
  if (num < 0.01) return `$${num.toFixed(8)}`;
  if (num < 1) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(4)}`;
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
