import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import { useTokenData, type EnrichedToken } from "@/lib/tokenDataProvider";
import {
  getTokenFactory,
  getTokenFactoryWrite,
  type TokenRecord,
} from "@/lib/contracts";

// Re-export EnrichedToken so existing imports still work
export type { EnrichedToken } from "@/lib/tokenDataProvider";

export interface CreateTokenParams {
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
  beneficiaries: string[];
  bpsAllocations: number[];
  cliffDays: number; // 30-90; 0 = use contract default (30)
  referrer: string;
}

export function useTokenFactory() {
  const { readProvider, signer, isConnected } = useWeb3();
  const { enrichedTokens, tokenCount, loading, refresh } = useTokenData();
  const [creating, setCreating] = useState(false);

  // Create a new token
  const createToken = useCallback(
    async (params: CreateTokenParams, usdcAmount: string) => {
      if (!signer || !isConnected) throw new Error("Wallet not connected");
      setCreating(true);
      try {
        const factory = getTokenFactoryWrite(signer);
        const value = ethers.parseEther(usdcAmount);
        const tx = await factory.createToken(
          [
            params.name,
            params.symbol,
            params.description,
            params.imageURI,
            [
              params.links.website,
              params.links.twitter,
              params.links.telegram,
              params.links.discord,
              params.links.extra,
            ],
            params.beneficiaries,
            params.bpsAllocations,
            params.cliffDays,
            params.referrer,
          ],
          { value }
        );
        const receipt = await tx.wait();

        // Parse TokenCreated event to get the new token address
        const iface = new ethers.Interface([
          "event TokenCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol)",
        ]);
        let tokenAddress = "";
        let curveAddress = "";
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (parsed?.name === "TokenCreated") {
              tokenAddress = parsed.args[0];
              curveAddress = parsed.args[1];
              break;
            }
          } catch {}
        }

        // Refresh shared token data
        await refresh();

        return { tokenAddress, curveAddress, txHash: receipt.hash };
      } finally {
        setCreating(false);
      }
    },
    [signer, isConnected, refresh]
  );

  // Get a single token record by address
  const getTokenRecord = useCallback(
    async (tokenAddress: string): Promise<TokenRecord | null> => {
      try {
        const factory = getTokenFactory(readProvider);
        const record = await factory.getTokenRecord(tokenAddress);
        if (record.token === ethers.ZeroAddress) return null;
        return record;
      } catch {
        return null;
      }
    },
    [readProvider]
  );

  // Get creator stats
  const getCreatorStats = useCallback(
    async (creator: string) => {
      try {
        const factory = getTokenFactory(readProvider);
        const result = await factory.getCreatorStats(creator);
        return {
          tokensCreated: Number(result[0]),
          tokensGraduated: Number(result[1]),
          arenaBattlesWon: Number(result[2]),
        };
      } catch {
        return { tokensCreated: 0, tokensGraduated: 0, arenaBattlesWon: 0 };
      }
    },
    [readProvider]
  );

  // Get creator's token list
  const getCreatorTokens = useCallback(
    async (creator: string): Promise<string[]> => {
      try {
        const factory = getTokenFactory(readProvider);
        const result = await factory.getCreatorStats(creator);
        const tokenList: string[] = [...result[3]];
        return tokenList;
      } catch {
        return [];
      }
    },
    [readProvider]
  );

  return {
    tokens: enrichedTokens.map((e) => e.record),
    enrichedTokens,
    loading,
    creating,
    tokenCount,
    createToken,
    fetchTokens: refresh,
    getTokenRecord,
    getCreatorStats,
    getCreatorTokens,
  };
}
