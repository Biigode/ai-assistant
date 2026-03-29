// src/core/db.ts
// Conexão com MongoDB

import { MongoClient, ServerApiVersion, type Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
let client: MongoClient | null = null;
let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;
  try {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      family: 4,
    });
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    isConnected = true;
    console.log("✅ MongoDB Atlas conectado com sucesso");
  } catch (err) {
    console.error(
      "❌ Erro ao conectar no MongoDB Atlas:",
      (err as Error).message,
    );
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected || !client) return;
  await client.close();
  isConnected = false;
}

export function getDB(): Db {
  if (!isConnected || !client) throw new Error("DB não conectada");
  const dbName = process.env.MONGODB_DATABASE || "daily-digest";
  return client.db(dbName);
}
