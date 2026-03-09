// src/test-telegram.js
// Teste de envio de mensagem via Telegram

import 'dotenv/config';
import { sendTelegram } from './telegram.js';

const chatId = process.env.TELEGRAM_CHAT_ID;
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!chatId || !token) {
  console.error('❌ Configure TELEGRAM_CHAT_ID e TELEGRAM_BOT_TOKEN no .env');
  process.exit(1);
}

const testMsg = `🧪 *Teste do Daily Digest*\n\nSe você recebeu esta mensagem, o Telegram está configurado corretamente!`;

sendTelegram(testMsg, chatId, token)
  .then(() => console.log('✅ Teste concluído!'))
  .catch(err => {
    console.error('❌ Teste falhou:', err.message);
    process.exit(1);
  });
