// duude.fun — Deployed contract addresses
// Network: Arc Testnet (chainId 5042002)
// Deployed: 2026-04-13 (redeployed — FeeVault multi-owner + new owners)

export const CHAIN_ID = 5042002;
export const RPC_URL = "https://rpc.testnet.arc.network";

export const ADDRESSES = {
  FeeVault: "0xE51456E01CB44e9B656c5D54BE22bBEC3A0f252B",
  LaunchToken_Impl: "0x65e9Dd20FA6F1643fB0199b69421A61E4e5660b9",
  BondingCurve_Impl: "0x9Dfca88207966a2180c5f59F70bF2eC86793E5Ef",
  VestingVault_Impl: "0xf256b373e17E58EA6E24c30A2975320254a7bBA7",
  PostMigrationPool_Impl: "0xdE73aF09a0DDC32e228Da97e2b60F369b5BA4CE5",
  PostMigrationFactory: "0xE87b516980247b07f01f9BC28d0B605Ab341f9d2",
  TokenFactory: "0x21c1eD19E091aB31D34Ae1546edef79584773924",
  ArenaRegistry: "0xcFaED45786554bF62870546f47349A1120F66a67",
} as const;
