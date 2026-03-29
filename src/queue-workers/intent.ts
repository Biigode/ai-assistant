// src/queue-workers/intent.ts
import 'dotenv/config';
import { checkOllama, classifyIntent } from '../ai/llm.ts';
import { connectQueue, consume, publish, QUEUES } from '../core/queue.ts';
import type { IntentMessage } from '../types/queue.ts';

async function processIntent({ chatId, messageId, userMessage }: IntentMessage): Promise<void> {
  console.log(`🔍 Classificando intent para ${chatId}: "${userMessage.substring(0, 50)}"`);
  try {
    const intent = await classifyIntent(userMessage);
    const nextQueue = intent === 'search' ? QUEUES.WEB_SEARCH : QUEUES.RESPONSE_GENERATE;
    await publish(nextQueue, { chatId, messageId, userMessage, intent });
    console.log(`➡️  Enviado para ${nextQueue}`);
  } catch (err) {
    console.error('❌ Erro na classificação:', (err as Error).message);
    await publish(QUEUES.RESPONSE_GENERATE, { chatId, messageId, userMessage, intent: 'chat' });
  }
}

async function start(): Promise<void> {
  console.log('🎯 Intent Worker starting...');
  await checkOllama();
  await connectQueue();
  await consume<IntentMessage>(QUEUES.INTENT_CLASSIFY, processIntent);
  console.log(`🎯 Ouvindo em ${QUEUES.INTENT_CLASSIFY}`);
}

start().catch(err => { console.error('❌ Intent Worker falhou:', err); process.exit(1); });
