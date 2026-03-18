// src/memory.js
// Histórico de conversa persistido no MongoDB
// Resolve o problema de perda de contexto ao reiniciar o bot

import { getDB } from './db.js';

const COLLECTION = 'conversation_history';
const MAX_MESSAGES = 10;

export async function addMessage(chatId, role, content) {
  const db = getDB();
  const col = db.collection(COLLECTION);

  await col.insertOne({
    chatId: chatId.toString(),
    role,
    content,
    createdAt: new Date(),
  });

  // Janela deslizante — remove mensagens mais antigas além do limite
  const count = await col.countDocuments({ chatId: chatId.toString() });
  if (count > MAX_MESSAGES) {
    const oldest = await col
      .find({ chatId: chatId.toString() })
      .sort({ createdAt: 1 })
      .limit(count - MAX_MESSAGES)
      .toArray();
    if (oldest.length > 0) {
      await col.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
    }
  }
}

export async function getHistory(chatId) {
  const db = getDB();
  const messages = await db
    .collection(COLLECTION)
    .find({ chatId: chatId.toString() })
    .sort({ createdAt: 1 })
    .toArray();
  return messages.map(m => ({ role: m.role, content: m.content }));
}

export async function clearHistory(chatId) {
  const db = getDB();
  await db.collection(COLLECTION).deleteMany({ chatId: chatId.toString() });
}

export async function buildContextString(chatId) {
  const history = await getHistory(chatId);
  if (history.length === 0) return '';
  return history
    .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
    .join('\n');
}
