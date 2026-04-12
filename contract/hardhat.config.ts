import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    arcTestnet: {
      type: "http",
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: [
        "0xc67461b47038b9b78669c436e3c30013229c9c8c8a0e5a68e1ec16b24c52a480",
      ],
    },
  },
};

export default config;
