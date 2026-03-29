// src/queue-workers/telegram-sender.ts
// Consome da fila TELEGRAM_OUTGOING e envia mensagens para o Telegram

import "dotenv/config";
import { connectQueue, consume, QUEUES } from "../core/queue.ts";
import {
  editMessage,
  sendLongMessage,
  sendMessage,
  sendWithInlineKeyboard,
} from "../telegram/telegram-api.ts";
import type { TelegramOutgoingMessage } from "../types/queue.ts";

async function processMessage(msg: TelegramOutgoingMessage): Promise<void> {
  console.log(`📨 Enviando (${msg.type}) para ${msg.chatId}`);

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      switch (msg.type) {
        case "message":
          await sendMessage(msg.text, msg.chatId, msg.token);
          break;
        case "longMessage":
          await sendLongMessage(msg.text, msg.chatId, msg.token);
          break;
        case "inlineKeyboard":
          if (msg.buttons) {
            await sendWithInlineKeyboard(
              msg.text,
              msg.chatId,
              msg.buttons,
              msg.token,
            );
          } else {
            await sendMessage(msg.text, msg.chatId, msg.token);
          }
          break;
        case "editMessage":
          await editMessage(
            msg.chatId,
            msg.msgId,
            msg.text,
            msg.buttons,
            msg.token,
          );
          break;
        default: {
          const _exhaustive: never = msg;
          console.warn(
            "Unknown message type:",
            (_exhaustive as TelegramOutgoingMessage).type,
          );
        }
      }
      console.log("✅ Mensagem enviada");
      return;
    } catch (err) {
      const message = (err as Error).message || String(err);
      console.error(`❌ Tentativa ${attempt}/${maxRetries} falhou:`, message);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  console.error(`❌ Falha definitiva ao enviar para ${msg.chatId}`);
}

async function start(): Promise<void> {
  console.log("📨 Telegram Sender Worker starting...");
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN não configurado");
    process.exit(1);
  }
  await connectQueue();
  await consume<TelegramOutgoingMessage>(
    QUEUES.TELEGRAM_OUTGOING,
    processMessage,
  );
  console.log(`📨 Ouvindo em ${QUEUES.TELEGRAM_OUTGOING}`);
}

start().catch((err) => {
  console.error("❌ Telegram Sender falhou:", err);
  process.exit(1);
});
