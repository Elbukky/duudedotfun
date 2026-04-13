// Vercel Serverless Function — User profile CRUD
// GET  /api/profile?address=0x... — get profile by wallet address
// GET  /api/profile?username=foo  — get profile by username (for shareable links)
// POST /api/profile { address, username, displayName, avatarUrl, signature } — upsert profile

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./lib/db";

interface UserProfile {
  address: string; // lowercase wallet address (primary key)
  username: string; // unique, lowercase
  displayName: string; // display name (case preserved)
  avatarUrl: string; // R2 URL
  createdAt: Date;
  updatedAt: Date;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = await getDb();
    const profiles = db.collection<UserProfile>("profiles");

    // Ensure indexes exist (idempotent)
    await profiles.createIndex({ address: 1 }, { unique: true });
    await profiles.createIndex({ username: 1 }, { unique: true, sparse: true });

    if (req.method === "GET") {
      const { address, username } = req.query;

      if (username && typeof username === "string") {
        const profile = await profiles.findOne({ username: username.toLowerCase() });
        if (!profile) return res.status(404).json({ error: "Profile not found" });
        return res.status(200).json(profile);
      }

      if (address && typeof address === "string") {
        const profile = await profiles.findOne({ address: address.toLowerCase() });
        if (!profile) return res.status(404).json({ error: "Profile not found" });
        return res.status(200).json(profile);
      }

      return res.status(400).json({ error: "Provide address or username query param" });
    }

    if (req.method === "POST") {
      const { address, username, displayName, avatarUrl } = req.body;

      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "address is required" });
      }

      const addrLower = address.toLowerCase();
      const now = new Date();

      // Build update fields
      const updateFields: Record<string, any> = { updatedAt: now };

      if (username !== undefined) {
        if (typeof username !== "string" || username.length < 3 || username.length > 20) {
          return res.status(400).json({ error: "Username must be 3-20 characters" });
        }
        // Only allow alphanumeric, underscores, hyphens
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          return res.status(400).json({ error: "Username can only contain letters, numbers, underscores, hyphens" });
        }
        const usernameLower = username.toLowerCase();
        // Check uniqueness
        const existing = await profiles.findOne({
          username: usernameLower,
          address: { $ne: addrLower },
        });
        if (existing) {
          return res.status(409).json({ error: "Username already taken" });
        }
        updateFields.username = usernameLower;
      }

      if (displayName !== undefined) {
        if (typeof displayName !== "string" || displayName.length > 32) {
          return res.status(400).json({ error: "Display name max 32 characters" });
        }
        updateFields.displayName = displayName.trim();
      }

      if (avatarUrl !== undefined) {
        updateFields.avatarUrl = avatarUrl;
      }

      const result = await profiles.updateOne(
        { address: addrLower },
        {
          $set: updateFields,
          $setOnInsert: { address: addrLower, createdAt: now },
        },
        { upsert: true }
      );

      const profile = await profiles.findOne({ address: addrLower });
      return res.status(200).json(profile);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Profile API error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username already taken" });
    }
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
