import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "./web3Provider";
import {
  getTokenFactory,
  getBondingCurve,
  getPostMigrationPool,
  type TokenRecord,
} from "./contracts";

// Enriched token data — shared across all pages
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
  retainedBuyers: bigint;
  buyPressureBps: bigint;
  postMigrationVolume: bigint;
  poolSpotPrice: bigint;
}

interface TokenDataState {
  enrichedTokens: EnrichedToken[];
  tokenCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const TokenDataContext = createContext<TokenDataState>({
  enrichedTokens: [],
  tokenCount: 0,
  loading: true,
  refresh: async () => {},
});

export const useTokenData = () => useContext(TokenDataContext);

const DEFAULT_METRICS = {
  totalBuyVolume: 0n,
  totalSellVolume: 0n,
  buyCount: 0n,
  sellCount: 0n,
  uniqueBuyerCount: 0n,
  holderCount: 0n,
  retainedBuyers: 0n,
  buyPressureBps: 0n,
  percentCompleteBps: 0n,
};

// Arcscan swap event parsing (shared)
const ARCSCAN_BASE = "https://testnet.arcscan.app/api/v2";
const SWAP_TOPIC = ethers.id(
  "Swap(address,address,uint256,uint256,uint256,uint256)"
).toLowerCase();
const SWAP_IFACE = new ethers.Interface([
  "event Swap(address indexed sender, address indexed to, uint256 tokenIn, uint256 usdcIn, uint256 tokenOut, uint256 usdcOut)",
]);

export const TokenDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { readProvider } = useWeb3();
  const [enrichedTokens, setEnrichedTokens] = useState<EnrichedToken[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchTokens = useCallback(async () => {
    // Dedup: skip if already fetching
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const factory = getTokenFactory(readProvider);
      const count = await factory.getTokenCount();
      if (!mountedRef.current) return;
      setTokenCount(Number(count));

      if (Number(count) === 0) {
        setEnrichedTokens([]);
        setLoading(false);
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

      // --- PHASE 1: RPC data (batched by provider) ---
      // Flatten all calls for all tokens into one Promise.all
      // For each token: spotPrice + realUSDCRaised + realTokensSold + getArenaMetrics = 4 calls
      // For graduated tokens: + poolSpotPrice = 5 calls
      // With batchMaxCount=50, these go as ~1-3 HTTP batch requests total.
      const enriched: EnrichedToken[] = await Promise.all(
        allRecords.map(async (record) => {
          try {
            const curve = getBondingCurve(record.curve, readProvider);

            // All 4 calls in one Promise.all (batched by ethers provider)
            const [spotPrice, realUSDCRaised, realTokensSold, metricsRaw] =
              await Promise.all([
                curve.spotPrice().catch(() => 0n),
                curve.realUSDCRaised().catch(() => 0n),
                curve.realTokensSold().catch(() => 0n),
                curve.getArenaMetrics().catch(() => null),
              ]);

            const metrics = metricsRaw
              ? {
                  totalBuyVolume: metricsRaw[0] as bigint,
                  totalSellVolume: metricsRaw[1] as bigint,
                  buyCount: metricsRaw[2] as bigint,
                  sellCount: metricsRaw[3] as bigint,
                  uniqueBuyerCount: metricsRaw[4] as bigint,
                  holderCount: metricsRaw[5] as bigint,
                  retainedBuyers: metricsRaw[6] as bigint,
                  buyPressureBps: metricsRaw[7] as bigint,
                  percentCompleteBps: metricsRaw[8] as bigint,
                }
              : DEFAULT_METRICS;

            // For graduated tokens, also fetch pool spot price
            let poolSpotPrice = 0n;
            if (
              record.graduated &&
              record.migrationPool &&
              record.migrationPool !== ethers.ZeroAddress
            ) {
              try {
                const pool = getPostMigrationPool(
                  record.migrationPool,
                  readProvider
                );
                poolSpotPrice = await pool.spotPrice();
              } catch {}
            }

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
              retainedBuyers: metrics.retainedBuyers,
              buyPressureBps: metrics.buyPressureBps,
              postMigrationVolume: 0n, // Phase 2
              poolSpotPrice,
            };
          } catch {
            return blankEnriched(record);
          }
        })
      );

      if (!mountedRef.current) return;
      setEnrichedTokens(enriched);
      setLoading(false);

      // --- PHASE 2: Background-fetch Arcscan swap volume for graduated tokens ---
      const graduatedIndices: number[] = [];
      enriched.forEach((e, i) => {
        if (
          e.record.graduated &&
          e.record.migrationPool &&
          e.record.migrationPool !== ethers.ZeroAddress
        ) {
          graduatedIndices.push(i);
        }
      });

      if (graduatedIndices.length > 0) {
        const volumeResults = await Promise.all(
          graduatedIndices.map(async (idx) => {
            const poolAddr = enriched[idx].record.migrationPool;
            try {
              const res = await fetch(
                `${ARCSCAN_BASE}/addresses/${poolAddr}/logs`
              );
              if (!res.ok) return { idx, volume: 0n };
              const data = await res.json();
              const logs = data.items || [];
              let vol = 0n;
              for (const log of logs) {
                if (!log.topics?.[0]) continue;
                if (log.topics[0].toLowerCase() !== SWAP_TOPIC) continue;
                try {
                  const topics = log.topics.filter(
                    (t: string | null) => t != null
                  );
                  const parsed = SWAP_IFACE.parseLog({
                    topics,
                    data: log.data,
                  });
                  if (parsed) {
                    const usdcIn = parsed.args.usdcIn as bigint;
                    const usdcOut = parsed.args.usdcOut as bigint;
                    vol += usdcIn > 0n ? usdcIn : usdcOut;
                  }
                } catch {}
              }
              return { idx, volume: vol };
            } catch {
              return { idx, volume: 0n };
            }
          })
        );

        if (!mountedRef.current) return;

        // Merge volumes into existing enriched array (immutable update)
        setEnrichedTokens((prev) => {
          const updated = [...prev];
          for (const { idx, volume } of volumeResults) {
            if (volume > 0n) {
              updated[idx] = { ...updated[idx], postMigrationVolume: volume };
            }
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("TokenDataProvider: fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
      fetchingRef.current = false;
    }
  }, [readProvider]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTokens();
    const interval = setInterval(fetchTokens, 30000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchTokens]);

  return (
    <TokenDataContext.Provider
      value={{ enrichedTokens, tokenCount, loading, refresh: fetchTokens }}
    >
      {children}
    </TokenDataContext.Provider>
  );
};

function blankEnriched(record: TokenRecord): EnrichedToken {
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
    retainedBuyers: 0n,
    buyPressureBps: 0n,
    postMigrationVolume: 0n,
    poolSpotPrice: 0n,
  };
}
