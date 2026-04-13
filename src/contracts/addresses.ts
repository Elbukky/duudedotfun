// duude.fun — Deployed contract addresses
// Network: Arc Testnet (chainId 5042002)
// Deployed: 2026-04-13 | Full redeploy: fee restructure + FeeVault single custody

export const CHAIN_ID = 5042002;
export const RPC_URL = "https://rpc.testnet.arc.network";

export const ADDRESSES = {
  FeeVault: "0xa29Ca2aF359988DfBf33962F289D621CdE367b9A",
  LaunchToken_Impl: "0xA1048d4737ec2662d66f6202A2B65e9889cDcC30",
  BondingCurve_Impl: "0x85Db3e7fe6DD58b239096247228Ebd51540A1581",
  VestingVault_Impl: "0x59308EC8A6d5B96e0Ec5F5a106Ce7610DF339512",
  PostMigrationPool_Impl: "0xC2c03A967dd463dc694061F63aD43063b48FcC20",
  PostMigrationFactory: "0xd7cC241BA0c8432164867b9D822d36782d005076",
  TokenFactory: "0x3c7e1cfF5EE3D7769dD5250eE0A215f1ef04675b",
  ArenaRegistry: "0x1375729eB51321dFd793e38AdA0833FD2EDE8379",
} as const;
