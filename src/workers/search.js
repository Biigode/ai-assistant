// src/workers/search.js
import 'dotenv/config';
import { connectQueue, consume, publish, QUEUES } from '../core/queue.js';
import { searchTopic } from '../digest/search.js';

async function processSearch({ chatId, messageId, userMessage, intent }) {
  console.log(`🔎 Buscando para ${chatId}: "${userMessage.substring(0, 50)}"`);
  try {
    const results = await searchTopic(userMessage, 5);
    await publish(QUEUES.RESPONSE_GENERATE, { chatId, messageId, userMessage, intent, searchResults: results });
  } catch (err) {
    console.error('❌ Erro na busca:', err.message);
    await publish(QUEUES.RESPONSE_GENERATE, { chatId, messageId, userMessage, intent, searchResults: [], error: err.message });
  }
}

async function start() {
  console.log('🔍 Search Worker starting...');
  await connectQueue();
  await consume(QUEUES.WEB_SEARCH, processSearch);
  console.log(`🔍 Ouvindo em ${QUEUES.WEB_SEARCH}`);
}

start().catch(err => { console.error('❌ Search Worker falhou:', err); process.exit(1); });
