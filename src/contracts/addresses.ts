// duude.fun — Deployed contract addresses
// Network: Arc Testnet (chainId 5042002)
// Deployed: 2026-04-12 (redeployed — graduation target changed to 2,500 USDC)

export const CHAIN_ID = 5042002;
export const RPC_URL = "https://rpc.testnet.arc.network";

export const ADDRESSES = {
  FeeVault: "0x963AdE0A6C2E91D695Fc04B4a630Cf6640350c1f",
  LaunchToken_Impl: "0xd738fa47962B635aC55197a0B40B675206f4451f",
  BondingCurve_Impl: "0x396AA446c8f1AD757B28A3910931bfBc717D0a24",
  VestingVault_Impl: "0x3dc1D9Bf695f4776E5C150dB6bD54c7DbF263021",
  PostMigrationPool_Impl: "0x854c2eA6dCdC8b807217d415FD234605771F63c4",
  PostMigrationFactory: "0x0A16d0f8EBaEee23bFBcFd42aDf418B8A376A266",
  TokenFactory: "0xaB434Aa131015A12af684D1bCb1584bCCc5B4b96",
  ArenaRegistry: "0x6aF024A0411FB3d9b988D49F37b5F83175F2B288",
} as const;
