// Vercel Serverless Function — Tasks / Quests system
// GET  /api/tasks?address=0x...                  — get user's task progress
// POST /api/tasks { address, task, payload? }     — verify/complete a task
// POST /api/tasks { address, action: "claim" }    — claim 100 USDC reward
//
// Tasks:
//   launch_token   — verified on-chain via TokenFactory.getCreatorStats()
//   trade_5        — verified via Arcscan Buy/Sell event logs
//   follow_twitter — one-click, no verification
//   tweet          — user submits tweet URL, verified via OEmbed, stored by canonical tweet ID

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureIndexes } from "./lib/db.js";
import { ethers } from "ethers";

// ── Config ──
const RPC_URL = "https://rpc.testnet.arc.network";
const TOKEN_FACTORY = "0x3c7e1cfF5EE3D7769dD5250eE0A215f1ef04675b";
const ARCSCAN_BASE = "https://testnet.arcscan.app/api/v2";

// Minimal ABI — only what we need
const FACTORY_ABI = [
  "function getCreatorStats(address creator) view returns (uint256 tokensCreated, uint256 tokensGraduated, uint256 arenaBattlesWon, address[] tokenList)",
  "function getTokenRecord(address token) view returns (tuple(address token, address curve, address creator, bool graduated, address migrationPool, address vestingVault))",
];

// Function selectors for buy(uint256,address) and sell(uint256,uint256) on BondingCurve
const BUY_SELECTOR = "0x7deb6025";
const SELL_SELECTOR = "0xd79875eb";

const TASK_NAMES = ["launch_token", "trade_5", "follow_twitter", "tweet"] as const;
type TaskName = (typeof TASK_NAMES)[number];

const REWARD_AMOUNT = "100"; // 100 USDC (native token, 18 decimals)

// ── Helpers ──

/** Send native USDC reward from server wallet to user */
async function sendReward(toAddress: string): Promise<string> {
  const privateKey = process.env.Private_key;
  if (!privateKey) throw new Error("Private_key env var not set");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(REWARD_AMOUNT),
  });

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Reward transaction failed on-chain");
  }
  return receipt.hash;
}

/** Extract the numeric tweet ID from any twitter/x URL, stripping query params */
function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
  return match ? match[1] : null;
}

/** Verify tweet content via Twitter OEmbed (free, no API key) */
async function verifyTweetContent(tweetId: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/i/status/${tweetId}&omit_script=true`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { valid: false, error: "Could not fetch tweet. Make sure it's a public tweet." };

    const data = await res.json();
    const html = (data.html || "").toLowerCase();

    // Accept: @duudedotfun mention, "duudedotfun" text, or "duude.fun" link
    if (
      html.includes("duude.fun") ||
      html.includes("duudedotfun") ||
      html.includes("@duudedotfun")
    ) {
      return { valid: true };
    }
    return { valid: false, error: "Tweet must mention @duudedotfun or include a duude.fun link" };
  } catch {
    return { valid: false, error: "Failed to verify tweet. Try again." };
  }
}

/** Check on-chain if user launched at least 1 token */
async function checkLaunchToken(address: string): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const factory = new ethers.Contract(TOKEN_FACTORY, FACTORY_ABI, provider);
    const stats = await factory.getCreatorStats(address);
    return Number(stats[0]) >= 1;
  } catch {
    return false;
  }
}

/** Count user's buy/sell trades across all bonding curves via Arcscan transactions */
async function countUserTrades(address: string): Promise<number> {
  try {
    // Query the user's outbound transactions and match by function selector.
    // The /logs endpoint only works for contract addresses (log emitters), not EOAs.
    const addrLower = address.toLowerCase();
    let count = 0;
    let nextPage: string | null = null;

    for (let page = 0; page < 5; page++) {
      const url = nextPage
        ? `${ARCSCAN_BASE}${nextPage}`
        : `${ARCSCAN_BASE}/addresses/${addrLower}/transactions`;

      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) break;
      const data = await res.json();
      const txns = data.items || [];

      for (const tx of txns) {
        if (tx.status !== "ok") continue; // skip failed txs
        // method field is the 4-byte selector (e.g. "0x7deb6025")
        const method = (tx.method || "").toLowerCase();
        if (method === BUY_SELECTOR || method === SELL_SELECTOR) {
          count++;
          continue;
        }
        // Fallback: check raw_input prefix
        const input = (tx.raw_input || "").toLowerCase();
        if (input.startsWith(BUY_SELECTOR) || input.startsWith(SELL_SELECTOR)) {
          count++;
        }
      }

      // Check for next page
      if (data.next_page_params) {
        const params = new URLSearchParams(data.next_page_params);
        nextPage = `/addresses/${addrLower}/transactions?${params.toString()}`;
      } else {
        break;
      }

      if (count >= 5) break; // We only need to know >= 5
    }

    return count;
  } catch {
    return 0;
  }
}

/** Get or create a fresh user task document */
function freshTaskDoc(address: string) {
  return {
    address,
    tasks: {
      launch_token: { completed: false, completedAt: null as Date | null },
      trade_5: { completed: false, completedAt: null as Date | null },
      follow_twitter: { completed: false, completedAt: null as Date | null },
      tweet: { completed: false, completedAt: null as Date | null, tweetId: null as string | null },
    },
    claimed: false,
    claimedAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── Handler ──
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = await getDb();
    await ensureIndexes(db);
    const userTasks = db.collection("user_tasks");
    const usedTweets = db.collection("used_tweets");

    // Ensure indexes for our collections (idempotent)
    await Promise.all([
      userTasks.createIndex({ address: 1 }, { unique: true }),
      usedTweets.createIndex({ tweetId: 1 }, { unique: true }),
    ]);

    // ── GET: fetch task progress ──
    if (req.method === "GET") {
      const { address } = req.query;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "address query param required" });
      }
      const addrLower = address.toLowerCase();
      const doc = await userTasks.findOne({ address: addrLower });
      return res.status(200).json(doc || freshTaskDoc(addrLower));
    }

    // ── POST: verify a task or claim ──
    if (req.method === "POST") {
      const { address, task, action, payload } = req.body;

      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "address is required" });
      }
      const addrLower = address.toLowerCase();

      // Upsert: ensure doc exists
      await userTasks.updateOne(
        { address: addrLower },
        { $setOnInsert: freshTaskDoc(addrLower) },
        { upsert: true }
      );

      // ── CLAIM action ──
      if (action === "claim") {
        const doc = await userTasks.findOne({ address: addrLower });
        if (!doc) return res.status(500).json({ error: "Task doc missing" });
        if (doc.claimed) return res.status(400).json({ error: "Already claimed" });

        // All 4 tasks must be completed
        const allDone = TASK_NAMES.every((t) => doc.tasks?.[t]?.completed);
        if (!allDone) {
          return res.status(400).json({ error: "Complete all tasks before claiming" });
        }

        // Send 100 USDC reward
        let txHash: string;
        try {
          txHash = await sendReward(addrLower);
        } catch (err: any) {
          console.error("Reward transfer failed:", err);
          return res.status(500).json({ error: "Reward transfer failed. Please try again or contact support." });
        }

        await userTasks.updateOne(
          { address: addrLower },
          { $set: { claimed: true, claimedAt: new Date(), claimTxHash: txHash, updatedAt: new Date() } }
        );

        const updated = await userTasks.findOne({ address: addrLower });
        return res.status(200).json({ success: true, txHash, doc: updated });
      }

      // ── VERIFY a specific task ──
      if (!task || !TASK_NAMES.includes(task as TaskName)) {
        return res.status(400).json({ error: `task must be one of: ${TASK_NAMES.join(", ")}` });
      }

      const taskName = task as TaskName;

      // Check if already completed
      const existing = await userTasks.findOne({ address: addrLower });
      if (existing?.tasks?.[taskName]?.completed) {
        return res.status(200).json({ success: true, already: true, doc: existing });
      }

      const now = new Date();

      // ── launch_token ──
      if (taskName === "launch_token") {
        const launched = await checkLaunchToken(addrLower);
        if (!launched) {
          return res.status(400).json({ error: "You haven't launched a token yet. Go to /launch to create one!" });
        }
        await userTasks.updateOne(
          { address: addrLower },
          { $set: { [`tasks.launch_token.completed`]: true, [`tasks.launch_token.completedAt`]: now, updatedAt: now } }
        );
      }

      // ── trade_5 ──
      else if (taskName === "trade_5") {
        const tradeCount = await countUserTrades(addrLower);
        if (tradeCount < 5) {
          return res.status(400).json({
            error: `You have ${tradeCount} trade(s). Need at least 5. Buy or sell tokens to complete this task!`,
            tradeCount,
          });
        }
        await userTasks.updateOne(
          { address: addrLower },
          { $set: { [`tasks.trade_5.completed`]: true, [`tasks.trade_5.completedAt`]: now, updatedAt: now } }
        );
      }

      // ── follow_twitter ──
      else if (taskName === "follow_twitter") {
        // No verification — one-click complete
        await userTasks.updateOne(
          { address: addrLower },
          { $set: { [`tasks.follow_twitter.completed`]: true, [`tasks.follow_twitter.completedAt`]: now, updatedAt: now } }
        );
      }

      // ── tweet ──
      else if (taskName === "tweet") {
        const tweetUrl = payload?.tweetUrl;
        if (!tweetUrl || typeof tweetUrl !== "string") {
          return res.status(400).json({ error: "payload.tweetUrl is required" });
        }

        const tweetId = extractTweetId(tweetUrl);
        if (!tweetId) {
          return res.status(400).json({ error: "Invalid tweet URL. Paste a link like https://x.com/you/status/123456" });
        }

        // Check if tweet ID already used by anyone
        const alreadyUsed = await usedTweets.findOne({ tweetId });
        if (alreadyUsed) {
          return res.status(400).json({ error: "This tweet has already been submitted by another user." });
        }

        // Verify tweet content
        const verification = await verifyTweetContent(tweetId);
        if (!verification.valid) {
          return res.status(400).json({ error: verification.error || "Tweet verification failed" });
        }

        // Reserve the tweet ID
        try {
          await usedTweets.insertOne({
            tweetId,
            address: addrLower,
            tweetUrl: `https://x.com/i/status/${tweetId}`,
            createdAt: now,
          });
        } catch (err: any) {
          if (err.code === 11000) {
            return res.status(400).json({ error: "This tweet has already been submitted." });
          }
          throw err;
        }

        await userTasks.updateOne(
          { address: addrLower },
          {
            $set: {
              [`tasks.tweet.completed`]: true,
              [`tasks.tweet.completedAt`]: now,
              [`tasks.tweet.tweetId`]: tweetId,
              updatedAt: now,
            },
          }
        );
      }

      const updated = await userTasks.findOne({ address: addrLower });
      return res.status(200).json({ success: true, doc: updated });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Tasks API error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
