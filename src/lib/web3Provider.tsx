// Web3 provider — bridges wagmi/RainbowKit → ethers v6
// Exports the same useWeb3() interface so all hooks/pages work unchanged.

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { CHAIN_ID, RPC_URL } from "@/contracts/addresses";
import { useAccount, useDisconnect, useConnectorClient } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

interface Web3State {
  provider: ethers.BrowserProvider | null;
  readProvider: ethers.JsonRpcProvider;
  signer: ethers.Signer | null;
  address: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  chainId: number | null;
  connect: () => void;
  disconnect: () => void;
}

// Singleton read-only provider (batched RPC, no wallet needed)
const readProvider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, {
  staticNetwork: true,
  batchMaxCount: 50,
  batchStallTime: 10,
});

const Web3Context = createContext<Web3State>({
  provider: null,
  readProvider,
  signer: null,
  address: null,
  isConnecting: false,
  isConnected: false,
  chainId: null,
  connect: () => {},
  disconnect: () => {},
});

export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address: wagmiAddress, isConnected: wagmiConnected, isConnecting: wagmiConnecting, chain } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  // Get wagmi connector client (only when connected)
  const { data: connectorClient } = useConnectorClient();

  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  // Track the last transport we bridged to avoid re-creating for the same connection
  const lastTransportRef = useRef<any>(null);

  // Bridge wagmi connector → ethers BrowserProvider + Signer
  useEffect(() => {
    if (!connectorClient || !wagmiConnected) {
      setProvider(null);
      setSigner(null);
      lastTransportRef.current = null;
      return;
    }

    const transport = connectorClient.transport;
    // Skip if same transport object (already bridged)
    if (transport === lastTransportRef.current) return;
    lastTransportRef.current = transport;

    (async () => {
      try {
        // wagmi's connector client exposes an EIP-1193 transport
        const bp = new ethers.BrowserProvider(transport, {
          chainId: CHAIN_ID,
          name: "Arc Testnet",
        });
        const s = await bp.getSigner();
        setProvider(bp);
        setSigner(s);
      } catch (err) {
        console.error("Failed to bridge wagmi → ethers:", err);
        setProvider(null);
        setSigner(null);
      }
    })();
  }, [connectorClient, wagmiConnected]);

  const connect = useCallback(() => {
    if (openConnectModal) {
      openConnectModal();
    }
  }, [openConnectModal]);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setProvider(null);
    setSigner(null);
    lastTransportRef.current = null;
  }, [wagmiDisconnect]);

  const address = wagmiAddress ?? null;
  const isConnected = wagmiConnected && !!address;
  const chainId = chain?.id ?? null;

  return (
    <Web3Context.Provider
      value={{
        provider,
        readProvider,
        signer,
        address,
        isConnecting: wagmiConnecting,
        isConnected,
        chainId,
        connect,
        disconnect,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};
