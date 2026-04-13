// Vercel Serverless Function — Token-specific chat
// GET  /api/chat/token?tokenAddress=0x...&limit=50&before=<timestamp>
// POST /api/chat/token { tokenAddress, senderAddress, message, signature? }
//   - On first ever message from this address, signature is required
//   - Server verifies signature matches senderAddress
//   - Sets chatVerified=true on profile so subsequent messages don't need signature

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureIndexes } from "../lib/db.js";
import { ethers } from "ethers";

interface ChatMessage {
  tokenAddress: string; // lowercase
  senderAddress: string; // lowercase
  message: string;
  timestamp: Date;
}

const SIGN_MESSAGE = "Sign this message to verify your wallet for duude.fun chat.\n\nThis does not cost any gas.";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = await getDb();
    await ensureIndexes(db);
    const messages = db.collection<ChatMessage>("token_chat");
    const profiles = db.collection("profiles");

    if (req.method === "GET") {
      const { tokenAddress, limit, before } = req.query;

      if (!tokenAddress || typeof tokenAddress !== "string") {
        return res.status(400).json({ error: "tokenAddress required" });
      }

      const lim = Math.min(parseInt(String(limit) || "50", 10), 100);
      const query: Record<string, any> = { tokenAddress: tokenAddress.toLowerCase() };

      if (before && typeof before === "string") {
        query.timestamp = { $lt: new Date(parseInt(before, 10)) };
      }

      const docs = await messages
        .find(query)
        .sort({ timestamp: -1 })
        .limit(lim)
        .toArray();

      // Return newest-first, client can reverse if needed
      return res.status(200).json(docs);
    }

    if (req.method === "POST") {
      const { tokenAddress, senderAddress, message, signature } = req.body;

      if (!tokenAddress || !senderAddress || !message) {
        return res.status(400).json({ error: "tokenAddress, senderAddress, message required" });
      }

      if (typeof message !== "string" || message.trim().length === 0 || message.length > 500) {
        return res.status(400).json({ error: "Message must be 1-500 characters" });
      }

      const addrLower = senderAddress.toLowerCase();

      // Check if user is chat-verified
      const profile = await profiles.findOne({ address: addrLower });
      const isVerified = profile?.chatVerified === true;

      if (!isVerified) {
        // First message ever — require signature
        if (!signature) {
          return res.status(403).json({
            error: "SIGNATURE_REQUIRED",
            message: "First chat message requires wallet signature verification",
          });
        }

        // Verify the signature
        try {
          const recovered = ethers.verifyMessage(SIGN_MESSAGE, signature);
          if (recovered.toLowerCase() !== addrLower) {
            return res.status(403).json({ error: "Signature does not match sender address" });
          }
        } catch (sigErr) {
          return res.status(403).json({ error: "Invalid signature" });
        }

        // Mark as verified in profile (upsert)
        await profiles.updateOne(
          { address: addrLower },
          {
            $set: { chatVerified: true, updatedAt: new Date() },
            $setOnInsert: { address: addrLower, createdAt: new Date() },
          },
          { upsert: true }
        );
      }

      const doc: ChatMessage = {
        tokenAddress: tokenAddress.toLowerCase(),
        senderAddress: addrLower,
        message: message.trim(),
        timestamp: new Date(),
      };

      await messages.insertOne(doc);
      return res.status(201).json(doc);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Token chat API error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
