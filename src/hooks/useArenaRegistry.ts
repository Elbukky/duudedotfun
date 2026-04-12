import { useState, useEffect, useCallback, useRef } from "react";
import { useWeb3 } from "@/lib/web3Provider";
import { useTokenData, type EnrichedToken } from "@/lib/tokenDataProvider";
import {
  getArenaRegistry,
  getBondingCurve,
  computeScore,
  type BattleParticipant,
  type Battle,
  type ArenaMetrics,
} from "@/lib/contracts";

export interface ArenaParticipantScore {
  token: string;
  curve: string;
  creator: string;
  score: number; // normalized 0-100
  rawScore: bigint;
  metrics: ArenaMetrics;
}

export interface ArenaBattleData {
  battle: Battle;
  participants: BattleParticipant[];
  leaderboard: ArenaParticipantScore[];
  timeRemaining: number;
  isActive: boolean;
}

export function useArenaRegistry() {
  const { readProvider } = useWeb3();
  const { enrichedTokens } = useTokenData();
  const [battleData, setBattleData] = useState<ArenaBattleData | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep enrichedTokens in a ref so fetchCurrentBattle always sees latest without re-creating
  const enrichedRef = useRef<EnrichedToken[]>(enrichedTokens);
  enrichedRef.current = enrichedTokens;

  const fetchCurrentBattle = useCallback(async () => {
    try {
      setLoading(true);
      const registry = getArenaRegistry(readProvider);

      const result = await registry.getCurrentBattle();
      const battleId = result[0];
      const startTime = result[1];
      const endTime = result[2];
      const resolved = result[4];
      const winner = result[5];

      const battle: Battle = { startTime, endTime, resolved, winner };
      const participants = await registry.getBattleParticipants(battleId);

      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = Math.max(0, Number(endTime) - now);
      const isActive =
        now >= Number(startTime) && now < Number(endTime) && !resolved;

      // Build a lookup map from enrichedTokens (from ref)
      const metricsMap = new Map<string, EnrichedToken>();
      for (const e of enrichedRef.current) {
        metricsMap.set(e.record.curve.toLowerCase(), e);
      }

      // Compute scores — reuse enrichedTokens metrics when available
      const leaderboard: ArenaParticipantScore[] = await Promise.all(
        participants.map(async (p: any) => {
          try {
            // Try to find cached metrics from enrichedTokens
            const cached = metricsMap.get(p.curve.toLowerCase());
            let metrics: ArenaMetrics;

            if (cached) {
              // Reuse metrics from shared context — no RPC call needed
              metrics = {
                totalBuyVolume: cached.totalBuyVolume,
                totalSellVolume: cached.totalSellVolume,
                buyCount: cached.buyCount,
                sellCount: cached.sellCount,
                uniqueBuyerCount: cached.uniqueBuyerCount,
                holderCount: cached.holderCount,
                retainedBuyers: cached.retainedBuyers,
                buyPressureBps: cached.buyPressureBps,
                percentCompleteBps: cached.bondingProgressBps,
              };
            } else {
              // Fallback: fetch from chain (only for tokens not yet in enrichedTokens)
              const curve = getBondingCurve(p.curve, readProvider);
              const m = await curve.getArenaMetrics();
              metrics = {
                totalBuyVolume: m[0],
                totalSellVolume: m[1],
                buyCount: m[2],
                sellCount: m[3],
                uniqueBuyerCount: m[4],
                holderCount: m[5],
                retainedBuyers: m[6],
                buyPressureBps: m[7],
                percentCompleteBps: m[8],
              };
            }

            // Raw score (for sorting precision)
            const rawScore =
              metrics.retainedBuyers * 300n +
              metrics.uniqueBuyerCount * 100n +
              metrics.totalBuyVolume / 10n ** 18n +
              metrics.buyPressureBps * 10n +
              metrics.holderCount * 50n +
              metrics.percentCompleteBps * 5n;

            return {
              token: p.token,
              curve: p.curve,
              creator: p.creator,
              score: computeScore(metrics),
              rawScore,
              metrics,
            };
          } catch {
            return {
              token: p.token,
              curve: p.curve,
              creator: p.creator,
              score: 0,
              rawScore: 0n,
              metrics: {
                totalBuyVolume: 0n,
                totalSellVolume: 0n,
                buyCount: 0n,
                sellCount: 0n,
                uniqueBuyerCount: 0n,
                holderCount: 0n,
                retainedBuyers: 0n,
                buyPressureBps: 0n,
                percentCompleteBps: 0n,
              },
            };
          }
        })
      );

      // Sort by raw score descending
      leaderboard.sort((a, b) =>
        b.rawScore > a.rawScore ? 1 : b.rawScore < a.rawScore ? -1 : 0
      );

      setBattleData({
        battle,
        participants,
        leaderboard,
        timeRemaining,
        isActive,
      });
    } catch (err) {
      console.error("Failed to fetch arena data:", err);
    } finally {
      setLoading(false);
    }
  }, [readProvider]);

  // Get creator arena record
  const getCreatorRecord = useCallback(
    async (creator: string) => {
      try {
        const registry = getArenaRegistry(readProvider);
        const record = await registry.getCreatorArenaRecord(creator);
        return {
          totalWins: Number(record.totalWins ?? record[0]),
          battlesParticipated: Number(record.battlesParticipated ?? record[1]),
        };
      } catch {
        return { totalWins: 0, battlesParticipated: 0 };
      }
    },
    [readProvider]
  );

  useEffect(() => {
    fetchCurrentBattle();
    const interval = setInterval(fetchCurrentBattle, 30000);
    return () => clearInterval(interval);
  }, [fetchCurrentBattle]);

  return {
    battleData,
    loading,
    fetchCurrentBattle,
    getCreatorRecord,
  };
}
