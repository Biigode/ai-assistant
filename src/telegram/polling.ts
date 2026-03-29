// src/telegram/polling.ts
// Apenas polling — publica mensagens na fila para processamento

import fetch from "node-fetch";
import { connectQueue, publish, QUEUES } from "../core/queue.ts";
import type { TelegramUpdate } from "../types/telegram.ts";

const TELEGRAM_API = "https://api.telegram.org";
let offset = 0;
let isRunning = false;

export async function startPolling(token: string): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  
  await connectQueue();
  console.log("🔄 Polling do Telegram iniciado...");

  while (isRunning) {
    try {
      const updates = await getUpdates(token);
      for (const update of updates) {
        await handleUpdate(update, token).catch((err: unknown) =>
          console.error("❌ Erro ao processar update:", (err as Error).message),
        );
        offset = update.update_id + 1;
      }
    } catch (err) {
      console.error("❌ Erro no polling:", (err as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export function stopPolling(): void {
  isRunning = false;
}

async function getUpdates(token: string): Promise<TelegramUpdate[]> {
  const url = `${TELEGRAM_API}/bot${token}/getUpdates?timeout=30&offset=${offset}`;
  const res = await fetch(url);
  const body = await res.json() as { ok: boolean; description?: string; result: TelegramUpdate[] };
  if (!body.ok) throw new Error(body.description);
  return body.result;
}

async function handleUpdate(update: TelegramUpdate, token: string): Promise<void> {
  const chatId = update.message?.chat?.id?.toString();
  const text = update.message?.text?.trim();
  const name = update.message?.chat?.first_name || "Usuário";
  const msgId = update.message?.message_id;

  const callbackQuery = update.callback_query;
  if (callbackQuery) {
    console.log(`🔘 Botão: ${name} → "${callbackQuery.data}"`);
    await publish(QUEUES.TELEGRAM_INCOMING, {
      type: "callback",
      chatId: callbackQuery.message.chat.id.toString(),
      msgId: callbackQuery.message.message_id,
      queryId: callbackQuery.id,
      name: callbackQuery.from.first_name || "Usuário",
      data: callbackQuery.data,
      token,
    });
    return;
  }

  if (!text) return;

  console.log(`💬 ${name} (${chatId}): ${text}`);
  await publish(QUEUES.TELEGRAM_INCOMING, { type: "message", chatId, text, name, msgId, token });
}
