// Vercel Serverless Function — Arena chat (global)
// GET  /api/chat/arena?limit=50&before=<timestamp>
// POST /api/chat/arena { senderAddress, message }

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../lib/db";

interface ArenaMessage {
  senderAddress: string; // lowercase
  message: string;
  timestamp: Date;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = await getDb();
    const messages = db.collection<ArenaMessage>("arena_chat");

    // Ensure index
    await messages.createIndex({ timestamp: -1 });

    if (req.method === "GET") {
      const { limit, before } = req.query;

      const lim = Math.min(parseInt(String(limit) || "50", 10), 100);
      const query: Record<string, any> = {};

      if (before && typeof before === "string") {
        query.timestamp = { $lt: new Date(parseInt(before, 10)) };
      }

      const docs = await messages
        .find(query)
        .sort({ timestamp: -1 })
        .limit(lim)
        .toArray();

      return res.status(200).json(docs);
    }

    if (req.method === "POST") {
      const { senderAddress, message } = req.body;

      if (!senderAddress || !message) {
        return res.status(400).json({ error: "senderAddress and message required" });
      }

      if (typeof message !== "string" || message.trim().length === 0 || message.length > 500) {
        return res.status(400).json({ error: "Message must be 1-500 characters" });
      }

      const doc: ArenaMessage = {
        senderAddress: senderAddress.toLowerCase(),
        message: message.trim(),
        timestamp: new Date(),
      };

      await messages.insertOne(doc);
      return res.status(201).json(doc);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Arena chat API error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
