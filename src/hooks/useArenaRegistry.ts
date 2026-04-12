import { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/lib/web3Provider";
import {
  getArenaRegistry,
  getBondingCurve,
  type BattleParticipant,
  type Battle,
  type ArenaMetrics,
} from "@/lib/contracts";

export interface ArenaParticipantScore {
  token: string;
  curve: string;
  creator: string;
  score: bigint;
  metrics: ArenaMetrics;
}

export interface ArenaBattleData {
  battle: Battle;
  participants: BattleParticipant[];
  leaderboard: ArenaParticipantScore[];
  timeRemaining: number; // seconds
  isActive: boolean;
}

export function useArenaRegistry() {
  const { readProvider } = useWeb3();
  const [battleData, setBattleData] = useState<ArenaBattleData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentBattle = useCallback(async () => {
    try {
      setLoading(true);
      const registry = getArenaRegistry(readProvider);

      // Get current battle
      const [startTime, endTime, resolved, winner] = await registry.getCurrentBattle();
      const battle: Battle = { startTime, endTime, resolved, winner };

      const currentBattleId = await registry.currentBattleId();
      const participants = await registry.getBattleParticipants(currentBattleId);

      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = Math.max(0, Number(endTime) - now);
      const isActive = now >= Number(startTime) && now < Number(endTime) && !resolved;

      // Compute scores for each participant
      const leaderboard: ArenaParticipantScore[] = await Promise.all(
        participants.map(async (p: any) => {
          try {
            const curve = getBondingCurve(p.curve, readProvider);
            const m = await curve.getArenaMetrics();
            const metrics: ArenaMetrics = {
              totalBuyVolume: m[0], totalSellVolume: m[1],
              buyCount: m[2], sellCount: m[3],
              uniqueBuyerCount: m[4], holderCount: m[5],
              retainedBuyers: m[6], buyPressureBps: m[7], percentCompleteBps: m[8],
            };

            // Score formula from ArenaRegistry contract:
            // (retainedBuyers*300) + (uniqueBuyers*100) + (buyVolumeUSDC/1e18) + (buyPressureBps*10) + (holderCount*50) + (percentCompleteBps*5)
            const score =
              metrics.retainedBuyers * 300n +
              metrics.uniqueBuyerCount * 100n +
              metrics.totalBuyVolume / (10n ** 18n) +
              metrics.buyPressureBps * 10n +
              metrics.holderCount * 50n +
              metrics.percentCompleteBps * 5n;

            return {
              token: p.token,
              curve: p.curve,
              creator: p.creator,
              score,
              metrics,
            };
          } catch {
            return {
              token: p.token,
              curve: p.curve,
              creator: p.creator,
              score: 0n,
              metrics: {
                totalBuyVolume: 0n, totalSellVolume: 0n,
                buyCount: 0n, sellCount: 0n,
                uniqueBuyerCount: 0n, holderCount: 0n,
                retainedBuyers: 0n, buyPressureBps: 0n, percentCompleteBps: 0n,
              },
            };
          }
        })
      );

      // Sort by score descending
      leaderboard.sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0));

      setBattleData({ battle, participants, leaderboard, timeRemaining, isActive });
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
          totalWins: Number(record[0]),
          battlesParticipated: Number(record[1]),
        };
      } catch {
        return { totalWins: 0, battlesParticipated: 0 };
      }
    },
    [readProvider]
  );

  useEffect(() => {
    fetchCurrentBattle();
    // Refresh every 30 seconds
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
