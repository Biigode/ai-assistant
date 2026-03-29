// src/chat.ts
// Orquestra o chat usando IA para classificar intents e gerar respostas

import { runResearchPipeline } from './ai/agents.ts';
import { analyzeGeneral } from './ai/analysis.ts';
import { classifyIntent, extractSearchQuery, generateChatResponse } from './ai/llm.ts';
import { addMessage, getHistory } from './core/memory.ts';
import { searchTopic } from './features/core/search.ts';
import type { SearchResult } from './types/index.ts';

export async function analyzeUserIntent(message: string): Promise<'search' | 'chat'> {
  return classifyIntent(message);
}

export async function handleChatMessage(chatId: string | number, message: string, name: string): Promise<string> {
  console.log(`💬 Chat de ${name} (${chatId}): "${message}"`);
  await addMessage(chatId, 'user', message);

  const intent = await analyzeUserIntent(message);
  console.log(`   Intent: ${intent}`);

  switch (intent) {
    case 'search':
      return await handleSearch(chatId, message);
    default:
      return await handleChat(chatId, message, name);
  }
}

async function handleChat(chatId: string | number, message: string, name: string): Promise<string> {
  const response = await generateChatResponse(message, null, { name });
  await addMessage(chatId, 'assistant', response);
  return response;
}

async function handleSearch(chatId: string | number, message: string): Promise<string> {
  let query: string;
  try {
    query = await extractSearchQuery(message);
  } catch {
    query = message.split(' ').filter(w => w.length > 3).slice(0, 5).join(' ');
  }

  const results = await searchTopic(query, 5);
  if (!results.length) {
    return `😕 Não encontrei resultados para "${query}".`;
  }

  const analysis = await analyzeGeneral(results, message);
  const cleaned = cleanText(analysis);

  if (!cleaned || indicatesNoAccess(cleaned)) {
    return buildFallbackList(results);
  }

  await addMessage(chatId, 'assistant', cleaned);
  return `🔍 Resultado:\n\n${cleaned}\n\nVerifique as fontes originais.`;
}

export async function handleNewsDetail(chatId: string | number, index: string): Promise<string | null> {
  const history = await getHistory(chatId);
  let lastResults: SearchResult[] | null = null;

  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      try {
        const parsed = JSON.parse(history[i].content);
        if (Array.isArray(parsed)) {
          lastResults = parsed as SearchResult[];
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!lastResults) return null;

  const idx = parseInt(index) - 1;
  if (idx < 0 || idx >= lastResults.length) {
    return `❌ Número inválido. Escolha entre 1 e ${lastResults.length}.`;
  }

  const r = lastResults[idx];
  return `📰 ${r.title}\n\n📰 Fonte: ${r.source}\n🔗 ${r.link}\n\n📝 Resumo:\n${r.snippet}\n\n⚠️ Verifique na fonte original!`;
}

export async function runResearchForChat(chatId: string | number, topic: string): Promise<string> {
  const result = await runResearchPipeline(topic);
  await addMessage(chatId, 'assistant', result.briefing);
  return result.briefing;
}

function cleanText(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();
}

function indicatesNoAccess(text: string): boolean {
  return ['não tenho acesso', 'informações em tempo real', 'pesquise em'].some(p =>
    text.toLowerCase().includes(p)
  );
}

function buildFallbackList(results: SearchResult[]): string {
  let msg = `📰 Resultados encontrados:\n\n`;
  results.forEach((r, i) => {
    msg += `${i + 1}. ${r.title}\n   📰 ${r.source}\n   🔗 ${r.link}\n\n`;
  });
  return msg;
}
