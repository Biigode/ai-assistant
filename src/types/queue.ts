// src/types/queue.ts
// Payloads que trafegam pelas filas RabbitMQ

import type { InlineButton } from "./telegram.ts";

// ── TELEGRAM_INCOMING ────────────────────────────────────────────────────────

export interface TelegramIncomingMessage {
  type: "message";
  chatId: string;
  text: string;
  name: string;
  msgId: number;
  token: string;
}

export interface TelegramIncomingCallback {
  type: "callback";
  chatId: string;
  msgId: number;
  queryId: string;
  name: string;
  data: string;
  token: string;
}

export type TelegramIncoming =
  | TelegramIncomingMessage
  | TelegramIncomingCallback;

// ── INTENT_CLASSIFY ──────────────────────────────────────────────────────────

export interface IntentMessage {
  chatId: string;
  messageId: number;
  userMessage: string;
}

// ── WEB_SEARCH ───────────────────────────────────────────────────────────────

export interface SearchQueueMessage {
  chatId: string;
  messageId: number;
  userMessage: string;
  intent: "search" | "chat";
}

// ── RESPONSE_GENERATE ────────────────────────────────────────────────────────

export interface ResponseGenerateMessage {
  chatId: string;
  messageId?: number;
  userMessage: string;
  intent?: "search" | "chat";
  searchResults?: import("./index.js").SearchResult[];
  error?: string;
}

// ── TELEGRAM_OUTGOING (discriminated union) ──────────────────────────────────

export interface OutgoingSimpleMessage {
  type: "message";
  chatId: string;
  text: string;
  token: string;
}

export interface OutgoingLongMessage {
  type: "longMessage";
  chatId: string;
  text: string;
  token: string;
}

export interface OutgoingInlineKeyboard {
  type: "inlineKeyboard";
  chatId: string;
  text: string;
  buttons: InlineButton[][] | null;
  token: string;
}

export interface OutgoingEditMessage {
  type: "editMessage";
  chatId: string;
  msgId: number;
  text: string;
  buttons?: InlineButton[][];
  token: string;
}

export type TelegramOutgoingMessage =
  | OutgoingSimpleMessage
  | OutgoingLongMessage
  | OutgoingInlineKeyboard
  | OutgoingEditMessage;

// ── Response Worker → Sender ─────────────────────────────────────────────────

export interface ResponseWorkerOutput {
  chatId: string;
  messageId?: number;
  response: string;
}
