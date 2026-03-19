// src/workers/intent.js
import 'dotenv/config';
import { connectQueue, consume, publish, QUEUES } from '../core/queue.js';
import { classifyIntent, checkOllama } from '../ai/llm.js';

async function processIntent({ chatId, messageId, userMessage }) {
  console.log(`🔍 Classificando intent para ${chatId}: "${userMessage.substring(0, 50)}"`);
  const intent = await classifyIntent(userMessage);
  const nextQueue = intent === 'search' ? QUEUES.WEB_SEARCH : QUEUES.RESPONSE_GENERATE;
  await publish(nextQueue, { chatId, messageId, userMessage, intent });
  console.log(`➡️  Enviado para ${nextQueue}`);
}

async function start() {
  console.log('🎯 Intent Worker starting...');
  await checkOllama();
  await connectQueue();
  await consume(QUEUES.INTENT_CLASSIFY, processIntent);
  console.log(`🎯 Ouvindo em ${QUEUES.INTENT_CLASSIFY}`);
}

start().catch(err => { console.error('❌ Intent Worker falhou:', err); process.exit(1); });
