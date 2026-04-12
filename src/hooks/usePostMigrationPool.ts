import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "@/lib/web3Provider";
import { getPostMigrationPool, getPostMigrationPoolWrite } from "@/lib/contracts";

export interface PoolStats {
  tokenReserve: bigint;
  usdcReserve: bigint;
  spotPrice: bigint;
  totalLPSupply: bigint;
  activeLPSupply: bigint;
}

export function usePostMigrationPool(poolAddress: string | null) {
  const { readProvider, signer, isConnected } = useWeb3();
  const [swapping, setSwapping] = useState(false);
  const [addingLiquidity, setAddingLiquidity] = useState(false);
  const [removingLiquidity, setRemovingLiquidity] = useState(false);

  const getPoolStats = useCallback(async (): Promise<PoolStats | null> => {
    if (!poolAddress || poolAddress === ethers.ZeroAddress) return null;
    try {
      const pool = getPostMigrationPool(poolAddress, readProvider);
      const stats = await pool.getPoolStats();
      return {
        tokenReserve: stats[0],
        usdcReserve: stats[1],
        spotPrice: stats[2],
        totalLPSupply: stats[3],
        activeLPSupply: stats[4],
      };
    } catch {
      return null;
    }
  }, [poolAddress, readProvider]);

  const getSpotPrice = useCallback(async (): Promise<bigint> => {
    if (!poolAddress || poolAddress === ethers.ZeroAddress) return 0n;
    try {
      const pool = getPostMigrationPool(poolAddress, readProvider);
      return await pool.spotPrice();
    } catch {
      return 0n;
    }
  }, [poolAddress, readProvider]);

  const swap = useCallback(
    async (tokenOut: bigint, usdcOut: bigint, maxIn: bigint) => {
      if (!signer || !isConnected || !poolAddress) throw new Error("Not connected");
      setSwapping(true);
      try {
        const pool = getPostMigrationPoolWrite(poolAddress, signer);
        const to = await signer.getAddress();
        // If buying tokens (usdcOut = 0, tokenOut > 0), need to send USDC as value
        const value = usdcOut === 0n ? maxIn : 0n;
        const tx = await pool.swap(tokenOut, usdcOut, to, maxIn, { value });
        return await tx.wait();
      } finally {
        setSwapping(false);
      }
    },
    [signer, isConnected, poolAddress]
  );

  const addLiquidity = useCallback(
    async (tokenAmount: string, usdcAmount: string, minLPOut: bigint = 0n) => {
      if (!signer || !isConnected || !poolAddress) throw new Error("Not connected");
      setAddingLiquidity(true);
      try {
        const pool = getPostMigrationPoolWrite(poolAddress, signer);
        const to = await signer.getAddress();
        const tokenAmt = ethers.parseEther(tokenAmount);
        const value = ethers.parseEther(usdcAmount);
        const tx = await pool.addLiquidity(tokenAmt, minLPOut, to, { value });
        return await tx.wait();
      } finally {
        setAddingLiquidity(false);
      }
    },
    [signer, isConnected, poolAddress]
  );

  const removeLiquidity = useCallback(
    async (lpAmount: string, minToken: bigint = 0n, minUSDC: bigint = 0n) => {
      if (!signer || !isConnected || !poolAddress) throw new Error("Not connected");
      setRemovingLiquidity(true);
      try {
        const pool = getPostMigrationPoolWrite(poolAddress, signer);
        const to = await signer.getAddress();
        const lpAmt = ethers.parseEther(lpAmount);
        const tx = await pool.removeLiquidity(lpAmt, minToken, minUSDC, to);
        return await tx.wait();
      } finally {
        setRemovingLiquidity(false);
      }
    },
    [signer, isConnected, poolAddress]
  );

  return {
    getPoolStats,
    getSpotPrice,
    swap,
    addLiquidity,
    removeLiquidity,
    swapping,
    addingLiquidity,
    removingLiquidity,
  };
}
