// src/workers/response.js
import 'dotenv/config';
import { connectQueue, consume, publish, QUEUES } from '../core/queue.js';
import { generateChatResponse, checkOllama } from '../ai/llm.js';
import { findUserByChatId } from '../../models/UserPreferences.js';
import { connectDB } from '../core/db.js';

async function processResponse({ chatId, messageId, userMessage, searchResults = [], error }) {
  console.log(`💬 Gerando resposta para ${chatId}`);
  let user = null;
  try { user = await findUserByChatId(chatId); } catch {}

  if (error) {
    await publish(QUEUES.TELEGRAM_OUTGOING, { chatId, messageId, response: 'Desculpe, não consegui buscar informações agora. Tente novamente.' });
    return;
  }

  const response = await generateChatResponse(userMessage, searchResults, user ? { name: user.name } : {});
  await publish(QUEUES.TELEGRAM_OUTGOING, { chatId, messageId, response });
}

async function start() {
  console.log('💬 Response Worker starting...');
  await checkOllama();
  await connectDB();
  await connectQueue();
  await consume(QUEUES.RESPONSE_GENERATE, processResponse);
  console.log(`💬 Ouvindo em ${QUEUES.RESPONSE_GENERATE}`);
}

start().catch(err => { console.error('❌ Response Worker falhou:', err); process.exit(1); });
