// src/workers/telegram-sender.js
// Telegram Sender Worker - Consome fila de saída e envia mensagens

import 'dotenv/config';
import { connectQueue, consume, QUEUES } from '../queue.js';
import TelegramBot from 'node-telegram-bot-api';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

async function sendMessage(message) {
  const { chatId, response } = message;
  
  console.log(`📨 Enviando mensagem para ${chatId}`);
  
  try {
    await bot.sendMessage(chatId, response);
    console.log(`✅ Mensagem enviada com sucesso`);
  } catch (err) {
    console.error(`❌ Erro ao enviar mensagem:`, err.message);
  }
}

async function start() {
  console.log('📨 Telegram Sender Worker starting...');
  
  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não configurado');
    process.exit(1);
  }
  
  await connectQueue();
  
  await consume(QUEUES.TELEGRAM_OUTGOING, sendMessage);
  
  console.log(`📨 Telegram Sender Worker ouvindo em ${QUEUES.TELEGRAM_OUTGOING}`);
}

start().catch(err => {
  console.error('❌ Telegram Sender Worker falhou:', err);
  process.exit(1);
});
