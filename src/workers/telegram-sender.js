// src/workers/telegram-sender.js
import 'dotenv/config';
import { connectQueue, consume, QUEUES } from '../core/queue.js';
import { sendLongTelegram } from '../telegram/telegram.js';

async function sendMessage({ chatId, response }) {
  console.log(`📨 Enviando mensagem para ${chatId}`);
  try {
    await sendLongTelegram(response, chatId);
    console.log('✅ Mensagem enviada');
  } catch (err) {
    console.error('❌ Erro ao enviar:', err.message);
  }
}

async function start() {
  console.log('📨 Telegram Sender Worker starting...');
  if (!process.env.TELEGRAM_BOT_TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN não configurado'); process.exit(1); }
  await connectQueue();
  await consume(QUEUES.TELEGRAM_OUTGOING, sendMessage);
  console.log(`📨 Ouvindo em ${QUEUES.TELEGRAM_OUTGOING}`);
}

start().catch(err => { console.error('❌ Telegram Sender falhou:', err); process.exit(1); });
