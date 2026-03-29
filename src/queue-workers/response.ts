// src/queue-workers/response.ts
import 'dotenv/config';
import { checkOllama, generateChatResponse } from '../ai/llm.ts';
import { connectDB } from '../core/db.ts';
import { connectQueue, consume, publish, QUEUES } from '../core/queue.ts';
import { findUserByChatId } from '../models/UserPreferences.ts';
import type { ResponseGenerateMessage } from '../types/queue.ts';

async function processResponse({ chatId, messageId, userMessage, searchResults = [], error }: ResponseGenerateMessage): Promise<void> {
  console.log(`💬 Gerando resposta para ${chatId}`);
  let userName = 'Usuário';
  try {
    const user = await findUserByChatId(chatId);
    if (user) userName = user.name;
  } catch { /* sem user, usa default */ }

  if (error) {
    await publish(QUEUES.TELEGRAM_OUTGOING, { chatId, messageId, response: 'Desculpe, não consegui buscar informações agora. Tente novamente.' });
    return;
  }

  const response = await generateChatResponse(userMessage, searchResults ?? null, { name: userName });
  await publish(QUEUES.TELEGRAM_OUTGOING, { chatId, messageId, response });
}

async function start(): Promise<void> {
  console.log('💬 Response Worker starting...');
  await checkOllama();
  await connectDB();
  await connectQueue();
  await consume<ResponseGenerateMessage>(QUEUES.RESPONSE_GENERATE, processResponse);
  console.log(`💬 Ouvindo em ${QUEUES.RESPONSE_GENERATE}`);
}

start().catch(err => { console.error('❌ Response Worker falhou:', err); process.exit(1); });
