// src/telegram.js
// Envio de mensagens via Telegram Bot API com suporte a Inline Keyboards

import fetch from 'node-fetch';

const TELEGRAM_API = 'https://api.telegram.org';

function resolveToken(botToken) {
  return botToken || process.env.TELEGRAM_BOT_TOKEN;
}

function log(chatId, message) {
  const preview = message.length > 80 ? message.substring(0, 80) + '...' : message;
  console.log(`\n📤 TELEGRAM [→ ${chatId}]: ${preview}`);
}

// ─── Envio básico ─────────────────────────────────────────────────────────────

export async function sendTelegram(message, chatId, botToken, options = {}) {
  const token = resolveToken(botToken);
  if (!chatId || !token) throw new Error('chatId e TELEGRAM_BOT_TOKEN são obrigatórios');

  log(chatId, message);

  const body = {
    chat_id: chatId,
    text: message,
    parse_mode: options.parseMode || undefined,
    ...( options.keyboard ? { reply_markup: JSON.stringify(options.keyboard) } : {} ),
  };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API: ${data.description}`);
  return data.result;
}

// ─── Envio com Inline Keyboard ────────────────────────────────────────────────

export async function sendWithButtons(message, chatId, buttons, botToken) {
  return sendTelegram(message, chatId, botToken, {
    keyboard: {
      inline_keyboard: buttons, // array de arrays de { text, callback_data }
    },
  });
}

// ─── Editar mensagem existente (útil para atualizar menus) ───────────────────

export async function editMessage(chatId, messageId, newText, buttons, botToken) {
  const token = resolveToken(botToken);
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    ...(buttons ? { reply_markup: JSON.stringify({ inline_keyboard: buttons }) } : {}),
  };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok && !data.description?.includes('not modified')) {
    console.warn('⚠️ editMessage:', data.description);
  }
  return data.result;
}

// ─── Responder callback query (confirma o clique no botão) ───────────────────

export async function answerCallback(callbackQueryId, text, botToken) {
  const token = resolveToken(botToken);
  await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ─── Registrar comandos no menu do Telegram ──────────────────────────────────
// Aparece quando o usuário clica no botão "/" no teclado

export async function registerBotCommands(botToken) {
  const token = resolveToken(botToken);
  const commands = [
    { command: 'menu',       description: '📋 Menu principal com botões' },
    { command: 'noticias',   description: '📰 Notícias dos seus interesses' },
    { command: 'digest',     description: '📦 Receber digest agora' },
    { command: 'perfil',     description: '👤 Ver seu perfil e interesses' },
    { command: 'adicionar',  description: '➕ Adicionar interesse' },
    { command: 'remover',    description: '➖ Remover interesse' },
    { command: 'horario',    description: '⏰ Alterar horário do digest' },
    { command: 'estilo',     description: '🎨 Alterar estilo do resumo' },
    { command: 'ajuda',      description: '❓ Ver todos os comandos' },
  ];

  const res = await fetch(`${TELEGRAM_API}/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });

  const data = await res.json();
  if (data.ok) console.log('✅ Comandos do bot registrados no Telegram');
  else console.warn('⚠️ Erro ao registrar comandos:', data.description);
}

// ─── Mensagens longas ─────────────────────────────────────────────────────────

export async function sendLongTelegram(message, chatId, botToken, options = {}) {
  const MAX_LENGTH = 4000;

  if (message.length <= MAX_LENGTH) {
    return sendTelegram(message, chatId, botToken, options);
  }

  const parts = [];
  let current = '';
  for (const line of message.split('\n')) {
    if ((current + '\n' + line).length > MAX_LENGTH) {
      parts.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.length > 1 ? `(${i + 1}/${parts.length})\n` : '';
    // Só coloca os botões na última parte
    const opts = i === parts.length - 1 ? options : {};
    await sendTelegram(prefix + parts[i], chatId, botToken, opts);
    if (i < parts.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return true;
}
