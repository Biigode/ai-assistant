// src/workers/search.js
// Search Worker - usa o novo search.js com DuckDuckGo (sem API key)

import 'dotenv/config';
import { connectQueue, consume, publish, QUEUES } from '../queue.js';
import { searchTopic } from '../search.js';

async function processSearch(message) {
  const { chatId, messageId, userMessage, intent } = message;
  console.log(`🔎 Buscando para chat ${chatId}: "${userMessage.substring(0, 50)}"`);

  try {
    const results = await searchTopic(userMessage, 5);
    console.log(`📊 Encontrados ${results.length} resultados`);

    await publish(QUEUES.RESPONSE_GENERATE, {
      chatId, messageId, userMessage, intent,
      searchResults: results
    });
    console.log(`➡️  Resultados enviados para Response Worker`);
  } catch (err) {
    console.error('❌ Erro na busca:', err.message);
    await publish(QUEUES.RESPONSE_GENERATE, {
      chatId, messageId, userMessage, intent,
      searchResults: [], error: err.message
    });
  }
}

async function start() {
  console.log('🔍 Search Worker starting...');
  await connectQueue();
  await consume(QUEUES.WEB_SEARCH, processSearch);
  console.log(`🔍 Search Worker ouvindo em ${QUEUES.WEB_SEARCH}`);
}

start().catch(err => {
  console.error('❌ Search Worker falhou:', err);
  process.exit(1);
});
