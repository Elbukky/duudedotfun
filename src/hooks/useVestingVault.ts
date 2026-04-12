import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import { getVestingVault } from "@/lib/contracts";
import VestingVaultABI from "@/contracts/abis/VestingVault.json";

export interface VestingSchedule {
  totalAllocation: bigint;
  claimed: bigint;
  claimableNow: bigint;
  cliffEnd: bigint;
  vestingEnd: bigint;
}

export interface VestingInfo {
  schedule: VestingSchedule;
  startTime: bigint;
  cliffDuration: bigint;
  linearDuration: bigint;
  totalVestingDuration: bigint;
  cliffDaysLeft: number;
  vestingDaysLeft: number;
  percentVested: number;
  isCliffPassed: boolean;
}

export function useVestingVault() {
  const { readProvider, signer, isConnected } = useWeb3();
  const [claiming, setClaiming] = useState(false);

  /**
   * Fetch full vesting info for a wallet from a vesting vault contract.
   */
  const getVestingInfo = useCallback(
    async (vaultAddress: string, walletAddress: string): Promise<VestingInfo | null> => {
      if (!vaultAddress || vaultAddress === ethers.ZeroAddress) return null;
      try {
        const vault = getVestingVault(vaultAddress, readProvider);

        // Check if wallet is a beneficiary (1-indexed, 0 = not a beneficiary)
        const idx = await vault.beneficiaryIndex(walletAddress);
        if (Number(idx) === 0) return null;

        const [schedule, startTime, cliffDuration, linearDuration, totalVestingDuration] =
          await Promise.all([
            vault.getVestingSchedule(walletAddress),
            vault.startTime(),
            vault.cliffDuration(),
            vault.linearDuration(),
            vault.totalVestingDuration(),
          ]);

        const now = BigInt(Math.floor(Date.now() / 1000));
        const cliffEnd: bigint = schedule[3];
        const vestingEnd: bigint = schedule[4];

        const cliffSecondsLeft = cliffEnd > now ? Number(cliffEnd - now) : 0;
        const cliffDaysLeft = Math.ceil(cliffSecondsLeft / 86400);

        const vestingSecondsLeft = vestingEnd > now ? Number(vestingEnd - now) : 0;
        const vestingDaysLeft = Math.ceil(vestingSecondsLeft / 86400);

        const totalAllocation: bigint = schedule[0];
        const claimed: bigint = schedule[1];
        const claimableNow: bigint = schedule[2];

        // Calculate percent vested
        let percentVested = 0;
        if (totalAllocation > 0n) {
          const vested = claimed + claimableNow;
          percentVested = Number((vested * 10000n) / totalAllocation) / 100;
        }

        return {
          schedule: {
            totalAllocation,
            claimed,
            claimableNow,
            cliffEnd,
            vestingEnd,
          },
          startTime,
          cliffDuration,
          linearDuration,
          totalVestingDuration,
          cliffDaysLeft,
          vestingDaysLeft,
          percentVested: Math.min(100, percentVested),
          isCliffPassed: cliffEnd <= now,
        };
      } catch (err) {
        console.error("getVestingInfo failed:", err);
        return null;
      }
    },
    [readProvider]
  );

  /**
   * Claim vested tokens from a vesting vault.
   */
  const claim = useCallback(
    async (vaultAddress: string) => {
      if (!signer || !isConnected) throw new Error("Not connected");
      setClaiming(true);
      try {
        const vault = new ethers.Contract(vaultAddress, VestingVaultABI, signer);
        const tx = await vault.claim();
        const receipt = await tx.wait();
        return receipt;
      } finally {
        setClaiming(false);
      }
    },
    [signer, isConnected]
  );

  /**
   * Get claimable amount for a specific wallet.
   */
  const getClaimable = useCallback(
    async (vaultAddress: string, walletAddress: string): Promise<bigint> => {
      if (!vaultAddress || vaultAddress === ethers.ZeroAddress) return 0n;
      try {
        const vault = getVestingVault(vaultAddress, readProvider);
        return await vault.claimable(walletAddress);
      } catch {
        return 0n;
      }
    },
    [readProvider]
  );

  return {
    getVestingInfo,
    claim,
    getClaimable,
    claiming,
  };
}
