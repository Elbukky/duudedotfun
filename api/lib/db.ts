// Shared MongoDB connection for Vercel serverless functions
// Env var: Mongodb_url — MongoDB Atlas connection string
//          Atlas_name  — Database name (default: Duudedotfun)

import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const uri = process.env.Mongodb_url;
  if (!uri) throw new Error("Mongodb_url env var not set");

  const dbName = process.env.Atlas_name || "Duudedotfun";

  const client = new MongoClient(uri);
  await client.connect();

  cachedClient = client;
  cachedDb = client.db(dbName);

  return cachedDb;
}
