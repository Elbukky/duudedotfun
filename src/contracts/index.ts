// duude.fun — Contract ABIs and addresses
// Auto-generated from deployment artifacts

// ── Addresses ───────────────────────────────────────────────────────────────
export { CHAIN_ID, RPC_URL, ADDRESSES } from "./addresses";

// ── ABIs ────────────────────────────────────────────────────────────────────
import FeeVaultABI from "./abis/FeeVault.json";
import LaunchTokenABI from "./abis/LaunchToken.json";
import BondingCurveABI from "./abis/BondingCurve.json";
import VestingVaultABI from "./abis/VestingVault.json";
import PostMigrationPoolABI from "./abis/PostMigrationPool.json";
import PostMigrationFactoryABI from "./abis/PostMigrationFactory.json";
import TokenFactoryABI from "./abis/TokenFactory.json";
import ArenaRegistryABI from "./abis/ArenaRegistry.json";

export const ABIS = {
  FeeVault: FeeVaultABI,
  LaunchToken: LaunchTokenABI,
  BondingCurve: BondingCurveABI,
  VestingVault: VestingVaultABI,
  PostMigrationPool: PostMigrationPoolABI,
  PostMigrationFactory: PostMigrationFactoryABI,
  TokenFactory: TokenFactoryABI,
  ArenaRegistry: ArenaRegistryABI,
} as const;

export {
  FeeVaultABI,
  LaunchTokenABI,
  BondingCurveABI,
  VestingVaultABI,
  PostMigrationPoolABI,
  PostMigrationFactoryABI,
  TokenFactoryABI,
  ArenaRegistryABI,
};
