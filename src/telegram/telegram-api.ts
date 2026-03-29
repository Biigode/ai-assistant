// src/telegram/telegram-api.ts
// Envio de mensagens via Telegram Bot API com suporte a Inline Keyboards

import fetch from "node-fetch";
import type { InlineButton, SendMessageOptions } from "../types/telegram.ts";

const TELEGRAM_API = "https://api.telegram.org";

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  result?: unknown;
}

function resolveToken(botToken?: string): string {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  return token;
}

export async function sendMessage(
  message: string,
  chatId: string | number,
  botToken?: string,
  options: SendMessageOptions = {},
): Promise<unknown> {
  const token = resolveToken(botToken);
  if (!chatId) throw new Error("chatId é obrigatório");

  const body = {
    chat_id: chatId,
    text: message,
    parse_mode: options.parseMode || undefined,
    ...(options.keyboard ? { reply_markup: options.keyboard } : {}),
  };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as TelegramApiResponse;
  if (!data.ok) throw new Error(`Telegram API: ${data.description}`);
  return data.result;
}

export async function sendWithInlineKeyboard(
  message: string,
  chatId: string | number,
  buttons: InlineButton[][],
  botToken?: string,
): Promise<unknown> {
  return sendMessage(message, chatId, botToken, {
    keyboard: { inline_keyboard: buttons },
  });
}

export async function editMessage(
  chatId: string | number,
  messageId: number,
  newText: string,
  buttons?: InlineButton[][],
  botToken?: string,
): Promise<unknown> {
  const token = resolveToken(botToken);
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  };
  const res = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as TelegramApiResponse;
  if (!data.ok && !data.description?.includes("not modified")) {
    console.warn("⚠️ editMessage:", data.description);
  }
  return data.result;
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
  botToken?: string,
): Promise<void> {
  const token = resolveToken(botToken);
  await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function registerBotCommands(botToken?: string): Promise<void> {
  const token = resolveToken(botToken);
  const commands = [
    { command: "menu", description: "📋 Menu principal" },
    { command: "noticias", description: "📰 Notícias dos seus interesses" },
    { command: "roteiro", description: "🎬 Gerar roteiro para YouTube" },
    { command: "resumo", description: "📦 Receber resumo do dia" },
    { command: "perfil", description: "👤 Ver seu perfil" },
    { command: "adicionar", description: "➕ Adicionar interesses" },
    { command: "remover", description: "➖ Remover interesses" },
    { command: "config", description: "⚙️ Configurações" },
  ];
  const res = await fetch(`${TELEGRAM_API}/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  const data = (await res.json()) as TelegramApiResponse;
  if (data.ok) console.log("✅ Comandos do bot registrados no Telegram");
  else console.warn("⚠️ Erro ao registrar comandos:", data.description);
}

export async function sendLongMessage(
  message: string,
  chatId: string | number,
  botToken?: string,
  options: SendMessageOptions = {},
): Promise<boolean> {
  const MAX_LENGTH = 4000;
  if (message.length <= MAX_LENGTH) {
    await sendMessage(message, chatId, botToken, options);
    return true;
  }

  const parts: string[] = [];
  let current = "";
  for (const line of message.split("\n")) {
    if ((current + "\n" + line).length > MAX_LENGTH) {
      parts.push(current.trim());
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.length > 1 ? `(${i + 1}/${parts.length})\n` : "";
    const opts = i === parts.length - 1 ? options : {};
    await sendMessage(prefix + parts[i], chatId, botToken, opts);
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }
  return true;
}
