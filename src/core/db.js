// src/core/db.js
// Conexão com MongoDB

import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client;
let isConnected = false;

export async function connectDB() {
  if (isConnected) return;
  try {
    client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      family: 4,
    });
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    isConnected = true;
    console.log('✅ MongoDB Atlas conectado com sucesso');
  } catch (err) {
    console.error('❌ Erro ao conectar no MongoDB Atlas:', err.message);
    process.exit(1);
  }
}

export async function disconnectDB() {
  if (!isConnected || !client) return;
  await client.close();
  isConnected = false;
}

export function getDB() {
  if (!isConnected || !client) throw new Error('DB não conectada');
  const dbName = process.env.MONGODB_DATABASE || 'daily-digest';
  return client.db(dbName);
}
