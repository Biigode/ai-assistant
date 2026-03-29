// src/types/telegram.ts
// Tipos da API do Telegram e componentes de UI

// ── Inline Keyboard ──────────────────────────────────────────────────────────

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface MenuReturn {
  text: string;
  buttons: InlineButton[][];
}

// ── Telegram Bot API Updates ─────────────────────────────────────────────────

export interface TelegramChat {
  id: number;
  first_name?: string;
}

export interface TelegramUpdateMessage {
  message_id: number;
  chat: TelegramChat;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: { first_name?: string };
  message: {
    chat: TelegramChat;
    message_id: number;
  };
  data: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramUpdateMessage;
  callback_query?: TelegramCallbackQuery;
}

// ── Send options ─────────────────────────────────────────────────────────────

export interface SendMessageOptions {
  parseMode?: string;
  keyboard?: { inline_keyboard: InlineButton[][] };
}
