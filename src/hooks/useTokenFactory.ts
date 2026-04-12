import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import {
  getTokenFactory,
  getTokenFactoryWrite,
  getBondingCurve,
  type TokenRecord,
} from "@/lib/contracts";

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
  referrer: string;
}

// Enriched token data for frontend display
export interface EnrichedToken {
  record: TokenRecord;
  spotPrice: bigint;
  realUSDCRaised: bigint;
  realTokensSold: bigint;
  holderCount: bigint;
  bondingProgressBps: bigint;
  totalBuyVolume: bigint;
  totalSellVolume: bigint;
  buyCount: bigint;
  sellCount: bigint;
  uniqueBuyerCount: bigint;
}

export function useTokenFactory() {
  const { readProvider, signer, isConnected } = useWeb3();
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [enrichedTokens, setEnrichedTokens] = useState<EnrichedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  // Fetch all tokens from factory
  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      const factory = getTokenFactory(readProvider);
      const count = await factory.getTokenCount();
      setTokenCount(Number(count));

      if (Number(count) === 0) {
        setTokens([]);
        setEnrichedTokens([]);
        return;
      }

      // Fetch all token records (paginated)
      const batchSize = 50;
      const allRecords: TokenRecord[] = [];
      for (let i = 0; i < Number(count); i += batchSize) {
        const limit = Math.min(batchSize, Number(count) - i);
        const records = await factory.getTokens(i, limit);
        allRecords.push(...records);
      }

      setTokens(allRecords);

      // Enrich with bonding curve data
      const enriched: EnrichedToken[] = await Promise.all(
        allRecords.map(async (record) => {
          try {
            const curve = getBondingCurve(record.curve, readProvider);
            const [spotPrice, realUSDCRaised, realTokensSold] = await Promise.all([
              curve.spotPrice().catch(() => 0n),
              curve.realUSDCRaised().catch(() => 0n),
              curve.realTokensSold().catch(() => 0n),
            ]);

            let metrics = {
              totalBuyVolume: 0n, totalSellVolume: 0n,
              buyCount: 0n, sellCount: 0n,
              uniqueBuyerCount: 0n, holderCount: 0n,
              retainedBuyers: 0n, buyPressureBps: 0n, percentCompleteBps: 0n,
            };

            try {
              const m = await curve.getArenaMetrics();
              metrics = {
                totalBuyVolume: m[0], totalSellVolume: m[1],
                buyCount: m[2], sellCount: m[3],
                uniqueBuyerCount: m[4], holderCount: m[5],
                retainedBuyers: m[6], buyPressureBps: m[7], percentCompleteBps: m[8],
              };
            } catch {}

            return {
              record,
              spotPrice,
              realUSDCRaised,
              realTokensSold,
              holderCount: metrics.holderCount,
              bondingProgressBps: metrics.percentCompleteBps,
              totalBuyVolume: metrics.totalBuyVolume,
              totalSellVolume: metrics.totalSellVolume,
              buyCount: metrics.buyCount,
              sellCount: metrics.sellCount,
              uniqueBuyerCount: metrics.uniqueBuyerCount,
            };
          } catch {
            return {
              record,
              spotPrice: 0n,
              realUSDCRaised: 0n,
              realTokensSold: 0n,
              holderCount: 0n,
              bondingProgressBps: 0n,
              totalBuyVolume: 0n,
              totalSellVolume: 0n,
              buyCount: 0n,
              sellCount: 0n,
              uniqueBuyerCount: 0n,
            };
          }
        })
      );

      setEnrichedTokens(enriched);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
    } finally {
      setLoading(false);
    }
  }, [readProvider]);

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
            params.referrer,
          ],
          { value }
        );
        const receipt = await tx.wait();

        // Parse TokenCreated event to get the new token address
        const iface = new ethers.Interface(
          ["event TokenCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol)"]
        );
        let tokenAddress = "";
        let curveAddress = "";
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === "TokenCreated") {
              tokenAddress = parsed.args[0]; // token (indexed)
              curveAddress = parsed.args[1]; // curve (indexed)
              break;
            }
          } catch {}
        }

        // Refresh tokens list
        await fetchTokens();

        return { tokenAddress, curveAddress, txHash: receipt.hash };
      } finally {
        setCreating(false);
      }
    },
    [signer, isConnected, fetchTokens]
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
        // getCreatorStats returns (tokensCreated, tokensGraduated, arenaBattlesWon, tokenList)
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
        // getCreatorStats returns (tokensCreated, tokensGraduated, arenaBattlesWon, tokenList)
        const result = await factory.getCreatorStats(creator);
        const tokenList: string[] = [...result[3]]; // 4th return value is address[]
        return tokenList;
      } catch {
        return [];
      }
    },
    [readProvider]
  );

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return {
    tokens,
    enrichedTokens,
    loading,
    creating,
    tokenCount,
    createToken,
    fetchTokens,
    getTokenRecord,
    getCreatorStats,
    getCreatorTokens,
  };
}
