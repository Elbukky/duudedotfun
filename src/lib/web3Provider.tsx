import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { CHAIN_ID, RPC_URL } from "@/contracts/addresses";

// Arc Testnet chain config
const ARC_TESTNET = {
  chainId: `0x${CHAIN_ID.toString(16)}`,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

interface Web3State {
  provider: ethers.BrowserProvider | null;
  readProvider: ethers.JsonRpcProvider;
  signer: ethers.Signer | null;
  address: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const readProvider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);

const Web3Context = createContext<Web3State>({
  provider: null,
  readProvider,
  signer: null,
  address: null,
  isConnecting: false,
  isConnected: false,
  chainId: null,
  connect: async () => {},
  disconnect: () => {},
});

export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);

  const switchToArc = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET.chainId }],
      });
    } catch (err: any) {
      // Chain not added yet — add it
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET],
        });
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setIsConnecting(true);
    try {
      const bp = new ethers.BrowserProvider(window.ethereum);
      await bp.send("eth_requestAccounts", []);
      const network = await bp.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        await switchToArc();
      }
      const s = await bp.getSigner();
      const addr = await s.getAddress();
      setProvider(bp);
      setSigner(s);
      setAddress(addr);
      setChainId(Number(network.chainId));
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [switchToArc]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAddress(accounts[0]);
      }
    };
    const handleChainChanged = () => {
      window.location.reload();
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect]);

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          connect();
        }
      });
    }
  }, []);

  return (
    <Web3Context.Provider value={{
      provider, readProvider, signer, address,
      isConnecting, isConnected: !!address, chainId,
      connect, disconnect,
    }}>
      {children}
    </Web3Context.Provider>
  );
};
