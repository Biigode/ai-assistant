// src/workers/response.js
// Response Worker - Gera resposta final e envia para fila de saída

import 'dotenv/config';
import { connectQueue, consume, publish, QUEUES } from '../queue.js';
import { generateChatResponse, checkOllama } from '../llm.js';
import { findUserByChatId } from '../../models/UserPreferences.js';
import { connectDB } from '../db.js';

async function processResponse(message) {
  const { chatId, messageId, userMessage, intent, searchResults = [], error } = message;
  console.log(`💬 Gerando resposta para chat ${chatId}`);

  await connectDB();

  let user = null;
  try {
    user = await findUserByChatId(chatId);
  } catch {
    console.warn('⚠️  Usuário não encontrado no DB');
  }

  const settings = user ? { name: user.name } : {};

  if (error) {
    await publish(QUEUES.TELEGRAM_OUTGOING, {
      chatId, messageId,
      response: `Desculpe, não consegui buscar informações agora. Tente novamente em instantes.`
    });
    return;
  }

  const response = await generateChatResponse(userMessage, searchResults, settings);

  await publish(QUEUES.TELEGRAM_OUTGOING, { chatId, messageId, response });
  console.log(`📤 Resposta enviada para fila de saída`);
}

async function start() {
  console.log('💬 Response Worker starting...');
  await checkOllama();
  await connectDB();
  await connectQueue();
  await consume(QUEUES.RESPONSE_GENERATE, processResponse);
  console.log(`💬 Response Worker ouvindo em ${QUEUES.RESPONSE_GENERATE}`);
}

start().catch(err => {
  console.error('❌ Response Worker falhou:', err);
  process.exit(1);
});
