// wagmi + RainbowKit configuration
// Arc uses USDC as native gas token (like ETH on Ethereum)
// Monad support coming soon

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc2.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Monascan",
      url: "https://monascan.io",
    },
  },
});

export const wagmiConfig = getDefaultConfig({
  appName: "duude.fun",
  projectId: "80860302c6914b5931906382db7c216e",
  chains: [arcTestnet, monad],
  ssr: false,
});
