// src/telegram-producer.js
// Telegram Producer - Recebe mensagens do Telegram

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { connectQueue, publish, QUEUES } from './queue.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const botName = process.env.BOT_NAME || 'telegram';

const bot = new TelegramBot(TOKEN, {
  polling: {
    autoStart: false
  }
});

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const messageId = msg.message_id;
  
  if (!text || text.startsWith('/')) {
    return;
  }
  
  console.log(`📥 Mensagem recebida de ${chatId}: "${text.substring(0, 50)}..."`);
  
  try {
    await publish(QUEUES.INTENT_CLASSIFY, {
      chatId,
      messageId,
      userMessage: text
    });
    console.log(`📤 Mensagem enviada para Intent Worker`);
  } catch (err) {
    console.error('❌ Erro ao publicar mensagem:', err);
  }
}

async function start() {
  console.log('📡 Telegram Producer starting...');
  
  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não configurado');
    process.exit(1);
  }
  
  await connectQueue();
  
  bot.on('message', handleMessage);
  
  try {
    await bot.startPolling();
    console.log('📡 Telegram Producer ouvindo mensagens (polling)...');
  } catch (err) {
    if (err.message.includes('terminated by other getUpdates')) {
      console.warn('⚠️  Outro polling está ativo. Tentando novamente em 5s...');
      setTimeout(async () => {
        try {
          await bot.startPolling();
          console.log('📡 Polling iniciado após retry');
        } catch (e) {
          console.error('❌ Falha ao iniciar polling:', e.message);
        }
      }, 5000);
    } else {
      throw err;
    }
  }
}

start().catch(err => {
  console.error('❌ Telegram Producer falhou:', err);
  process.exit(1);
});
