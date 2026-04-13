// Vercel Serverless Function — Batch resolve addresses to profiles
// POST /api/profiles/batch { addresses: ["0x...", "0x..."] }
// Returns array of profiles for the given addresses

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureIndexes } from "./lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: "addresses array required" });
    }

    // Cap at 50 addresses per request
    const capped = addresses.slice(0, 50).map((a: string) => a.toLowerCase());

    const db = await getDb();
    await ensureIndexes(db);
    const profiles = db.collection("profiles");

    const docs = await profiles
      .find({ address: { $in: capped } })
      .project({ address: 1, username: 1, displayName: 1, avatarUrl: 1, _id: 0 })
      .toArray();

    // Build a map for easy lookup
    const map: Record<string, any> = {};
    for (const doc of docs) {
      map[doc.address] = doc;
    }

    return res.status(200).json(map);
  } catch (err: any) {
    console.error("Batch profiles error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
