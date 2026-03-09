// models/UserPreferences.js
// Schema para guardar os interesses do usuário no MongoDB Atlas

import { getDB } from '../src/db.js';

const COLLECTION = 'userpreferences';

const interestSchema = {
  topic: String,
  keywords: [String],
  active: { type: Boolean, default: true },
  addedAt: { type: Date, default: () => new Date() }
};

const userPreferencesSchema = {
  telegramChatId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  interests: [interestSchema],
  digestSettings: {
    language: { type: String, default: 'pt-BR' },
    maxArticlesPerTopic: { type: Number, default: 3 },
    summaryStyle: { type: String, default: 'bullet-points' },
    cronSchedule: { type: String, default: '0 8 * * *' }
  },
  active: { type: Boolean, default: true },
  lastDigestSentAt: Date,
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
};

export async function findUserByChatId(chatId) {
  const db = getDB();
  return db.collection(COLLECTION).findOne({ telegramChatId: chatId, active: true });
}

export async function findAllActiveUsers() {
  const db = getDB();
  return db.collection(COLLECTION).find({ active: true }).toArray();
}

export async function createOrUpdateUser(userData) {
  const db = getDB();
  const filter = { telegramChatId: userData.telegramChatId };
  const update = {
    $set: { ...userData, updatedAt: new Date() },
    $setOnInsert: { createdAt: new Date() }
  };
  const options = { upsert: true, returnDocument: 'after' };
  return db.collection(COLLECTION).findOneAndUpdate(filter, update, options);
}

export async function saveUser(userData) {
  const db = getDB();
  const filter = { telegramChatId: userData.telegramChatId };
  const update = {
    $set: {
      ...userData,
      updatedAt: new Date()
    }
  };
  return db.collection(COLLECTION).updateOne(filter, update, { upsert: true });
}

export default {
  findUserByChatId,
  findAllActiveUsers,
  createOrUpdateUser,
  saveUser
};
