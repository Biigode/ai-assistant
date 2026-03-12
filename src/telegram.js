// src/telegram.js
// Envio de mensagens via Telegram Bot API

import fetch from 'node-fetch';

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Envia uma mensagem via Telegram
 * @param {string} message - Texto da mensagem
 * @param {string} chatId - Chat ID do usuário
 * @param {string} botToken - Token do bot
 */
export async function sendTelegram(message, chatId, botToken) {
  const resolvedToken = botToken || process.env.TELEGRAM_BOT_TOKEN;

  console.log(`\n========== TELEGRAM [→ ${chatId}] ==========\n${message}\n=================================================\n`);

  if (!chatId || !resolvedToken) {
    throw new Error('chatId e TELEGRAM_BOT_TOKEN são obrigatórios');
  }

  const params = new URLSearchParams({
    chat_id: chatId,
    text: message,
  });

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${resolvedToken}/sendMessage?${params}`);
    const body = await res.json();

    if (!body.ok) {
      throw new Error(`Telegram API retornou: ${body.description}`);
    }

    return true;
  } catch (err) {
    console.error('❌ Erro ao enviar Telegram:', err.message);
    throw err;
  }
}

/**
 * Quebra mensagens longas em partes (Telegram tem limite de 4096 chars)
 */
export async function sendLongTelegram(message, chatId, botToken) {
  const MAX_LENGTH = 4000;

  if (message.length <= MAX_LENGTH) {
    return sendTelegram(message, chatId, botToken);
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

  console.log(`📤 Enviando ${parts.length} parte(s) para ${chatId}...`);

  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.length > 1 ? `(${i + 1}/${parts.length})\n` : '';
    await sendTelegram(prefix + parts[i], chatId, botToken);
    if (i < parts.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  return true;
}
