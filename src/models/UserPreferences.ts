// src/models/UserPreferences.ts
// Operações CRUD para preferências do usuário no MongoDB Atlas

import { getDB } from "../core/db.ts";
import type { UserPreference } from "../types/index.ts";

const COLLECTION = "userpreferences";

export async function findUserByChatId(
  chatId: string,
): Promise<UserPreference | null> {
  const db = getDB();
  return db
    .collection<UserPreference>(COLLECTION)
    .findOne({ telegramChatId: chatId, active: true });
}

export async function findAllActiveUsers(): Promise<UserPreference[]> {
  const db = getDB();
  return db
    .collection<UserPreference>(COLLECTION)
    .find({ active: true })
    .toArray();
}

export async function createOrUpdateUser(
  userData: Partial<UserPreference> & { telegramChatId: string },
): Promise<UserPreference | null> {
  const db = getDB();
  const filter = { telegramChatId: userData.telegramChatId };
  const { createdAt, ...rest } = userData;
  const update = {
    $set: { ...rest, updatedAt: new Date() },
    $setOnInsert: { createdAt: new Date() },
  };
  const result = await db
    .collection<UserPreference>(COLLECTION)
    .findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: "after",
    });
  return result;
}

export async function saveUser(
  userData: Partial<UserPreference> & { telegramChatId: string },
): Promise<void> {
  const db = getDB();
  const filter = { telegramChatId: userData.telegramChatId };
  const { createdAt, ...rest } = userData;
  const update = {
    $set: { ...rest, updatedAt: new Date() },
    $setOnInsert: { createdAt: new Date() },
  };
  await db
    .collection<UserPreference>(COLLECTION)
    .updateOne(filter, update, { upsert: true });
}
