// duude.fun — Deployed contract addresses
// Network: Arc Testnet (chainId 5042002)
// Deployed: 2026-04-12 (redeployed — fixed PostMigrationPool initializer bug)

export const CHAIN_ID = 5042002;
export const RPC_URL = "https://rpc.testnet.arc.network";

export const ADDRESSES = {
  FeeVault: "0xC9C22C0EBEB13c6Ed1e1237E0bc69a96a78f7A9d",
  LaunchToken_Impl: "0xef0D1005c60b46ce6EdD68C541070F1c9669951D",
  BondingCurve_Impl: "0xfA656C097ab933560EA35D94eefD42A4204a021C",
  VestingVault_Impl: "0x03A3198FE2807bf85887755090cB5A32Ba660C75",
  PostMigrationPool_Impl: "0x6c883C8da876BC85BD7150Cb3A53cd1798036c43",
  PostMigrationFactory: "0xE81a902283bFe107F2B6064cE52e521dA4991E70",
  TokenFactory: "0xE87b127907F8DDD64Eb57e6b51BC44FCA6c9884b",
  ArenaRegistry: "0x8dc9fFfB44270021fB41D1fa189fc7d01E695daD",
} as const;
