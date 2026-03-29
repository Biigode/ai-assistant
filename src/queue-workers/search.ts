// src/queue-workers/search.ts
import "dotenv/config";
import { connectQueue, consume, publish, QUEUES } from "../core/queue.ts";
import { searchTopic } from "../features/core/search.ts";
import type { SearchQueueMessage } from "../types/queue.ts";

async function processSearch({ chatId, messageId, userMessage, intent }: SearchQueueMessage): Promise<void> {
  console.log(`🔎 Buscando para ${chatId}: "${userMessage.substring(0, 50)}"`);
  try {
    const results = await searchTopic(userMessage, 5);
    await publish(QUEUES.RESPONSE_GENERATE, {
      chatId,
      messageId,
      userMessage,
      intent,
      searchResults: results,
    });
  } catch (err) {
    console.error("❌ Erro na busca:", (err as Error).message);
    await publish(QUEUES.RESPONSE_GENERATE, {
      chatId,
      messageId,
      userMessage,
      intent,
      searchResults: [],
      error: (err as Error).message,
    });
  }
}

async function start(): Promise<void> {
  console.log("🔍 Search Worker starting...");
  await connectQueue();
  await consume<SearchQueueMessage>(QUEUES.WEB_SEARCH, processSearch);
  console.log(`🔍 Ouvindo em ${QUEUES.WEB_SEARCH}`);
}

start().catch((err) => {
  console.error("❌ Search Worker falhou:", err);
  process.exit(1);
});
