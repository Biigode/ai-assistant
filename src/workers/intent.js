// src/workers/intent.js
// Intent Worker - Classifica mensagens e redireciona para a fila correta

import 'dotenv/config';
import { connectQueue, consume, publish, QUEUES } from '../queue.js';
import { classifyIntent, checkOllama } from '../llm.js';

async function processIntent(message) {
  const { chatId, messageId, userMessage } = message;
  console.log(`🔍 Classificando intent para chat ${chatId}: "${userMessage.substring(0, 50)}"`);

  const intent = await classifyIntent(userMessage);
  console.log(`📌 Intent classificada: ${intent}`);

  const nextQueue = intent === 'search' ? QUEUES.WEB_SEARCH : QUEUES.RESPONSE_GENERATE;

  await publish(nextQueue, {
    chatId, messageId, userMessage, intent,
    originalMessage: message
  });

  console.log(`➡️  Mensagem enviada para ${nextQueue}`);
}

async function start() {
  console.log('🎯 Intent Worker starting...');
  await checkOllama();
  await connectQueue();
  await consume(QUEUES.INTENT_CLASSIFY, processIntent);
  console.log(`🎯 Intent Worker ouvindo em ${QUEUES.INTENT_CLASSIFY}`);
}

start().catch(err => {
  console.error('❌ Intent Worker falhou:', err);
  process.exit(1);
});
