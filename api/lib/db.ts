// Shared MongoDB connection for Vercel serverless functions
// Env var: Mongodb_url — MongoDB Atlas connection string
//          Atlas_name  — Database name (default: Duudedotfun)

import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// Track whether indexes have been ensured this process lifecycle
let indexesEnsured = false;

export async function getDb(): Promise<Db> {
  // If we have a cached connection, verify it's still alive
  if (cachedClient && cachedDb) {
    try {
      // Quick ping to check connection health
      await cachedDb.command({ ping: 1 });
      return cachedDb;
    } catch {
      // Connection is stale — close and reconnect
      console.warn("MongoDB connection stale, reconnecting...");
      try { await cachedClient.close(); } catch {}
      cachedClient = null;
      cachedDb = null;
    }
  }

  const uri = process.env.Mongodb_url;
  if (!uri) throw new Error("Mongodb_url env var not set");

  const dbName = process.env.Atlas_name || "Duudedotfun";

  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await client.connect();

  cachedClient = client;
  cachedDb = client.db(dbName);

  return cachedDb;
}

/**
 * Ensure indexes exist — call once per cold start, not every request.
 * Returns immediately if already ensured this process lifecycle.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;

  try {
    const profiles = db.collection("profiles");
    const tokenChat = db.collection("token_chat");
    const arenaChat = db.collection("arena_chat");

    await Promise.all([
      profiles.createIndex({ address: 1 }, { unique: true }),
      profiles.createIndex({ username: 1 }, { unique: true, sparse: true }),
      tokenChat.createIndex({ tokenAddress: 1, timestamp: -1 }),
      arenaChat.createIndex({ timestamp: -1 }),
    ]);

    indexesEnsured = true;
  } catch (err) {
    console.error("Failed to ensure indexes:", err);
    // Don't block requests — indexes may already exist
  }
}
