// src/core/memory.ts
// Histórico de conversa persistido no MongoDB — janela deslizante de 10 mensagens

import type { ConversationMessage } from "../types/index.ts";
import { getDB } from "./db.ts";

const COLLECTION = "conversation_history";
const MAX_MESSAGES = 10;

export async function addMessage(
  chatId: string | number,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const db = getDB();
  const col = db.collection<ConversationMessage>(COLLECTION);
  await col.insertOne({
    chatId: chatId.toString(),
    role,
    content,
    createdAt: new Date(),
  });

  const count = await col.countDocuments({ chatId: chatId.toString() });
  if (count > MAX_MESSAGES) {
    const oldest = await col
      .find({ chatId: chatId.toString() })
      .sort({ createdAt: 1 })
      .limit(count - MAX_MESSAGES)
      .toArray();
    if (oldest.length > 0)
      await col.deleteMany({ _id: { $in: oldest.map((d) => d._id!) } });
  }
}

export async function getHistory(
  chatId: string | number,
): Promise<Pick<ConversationMessage, "role" | "content">[]> {
  const db = getDB();
  const messages = await db
    .collection<ConversationMessage>(COLLECTION)
    .find({ chatId: chatId.toString() })
    .sort({ createdAt: 1 })
    .toArray();
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function clearHistory(chatId: string | number): Promise<void> {
  const db = getDB();
  await db.collection(COLLECTION).deleteMany({ chatId: chatId.toString() });
}

export async function buildContextString(
  chatId: string | number,
): Promise<string> {
  const history = await getHistory(chatId);
  if (!history.length) return "";
  return history
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
    .join("\n");
}
