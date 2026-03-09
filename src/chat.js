// src/chat.js
// Chatbot conversacional com Ollama

import { Ollama } from 'ollama';
import { sendLongTelegram, sendTelegram } from './telegram.js';
import { searchTopic } from './search.js';

const ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434' });
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

const MAX_MESSAGE_LENGTH = 3500;

const conversationHistory = new Map();

function addToHistory(chatId, role, content) {
  if (!conversationHistory.has(chatId)) {
    conversationHistory.set(chatId, []);
  }
  const history = conversationHistory.get(chatId);
  history.push({ role, content });
  if (history.length > 10) history.shift();
}

function buildContext(chatId) {
  const history = conversationHistory.get(chatId) || [];
  return history.map(m => `${m.role}: ${m.content}`).join('\n');
}

function detectIntent(message) {
  const lower = message.toLowerCase();
  
  if (lower.includes('buscar') || lower.includes('procurar') || lower.includes('pesquisar') ||
      lower.includes('tv') || lower.includes('notebook') || lower.includes('celular') || 
      lower.includes('produto') || lower.includes('comprar') || lower.includes('preço')) {
    return 'search';
  }
  
  if (lower.includes('notícia') || lower.includes('noticias') || lower.includes('novidade')) {
    return 'news';
  }
  
  return 'chat';
}

export async function handleChatMessage(chatId, message, name) {
  const intent = detectIntent(message);
  
  console.log(`💬 Chat de ${name} (${chatId}): "${message}" [intent: ${intent}]`);
  
  if (intent === 'search') {
    return await handleSearchRequest(chatId, message, name);
  }
  
  if (intent === 'news') {
    return await handleNewsRequest(chatId, message, name);
  }
  
  return await handleGeneralChat(chatId, message, name);
}

async function handleSearchRequest(chatId, message, name) {
  const topic = message
    .replace(/buscar|procurar|pesquisar|produto|comprar|preço|sobre|me|a|o|um|uma|de|da|do|em|para/gi, '')
    .trim();
  
  if (!topic) {
    return await sendTelegram('🔍 O que você quer buscar?', chatId);
  }
  
  await sendLongTelegram(`🔍 Buscando informações sobre "${topic}"...`, chatId);
  
  const results = await searchTopic(topic, 3);
  
  if (results.length === 0) {
    return await sendLongTelegram(
      `😕 Não encontrei informações sobre "${topic}".\n\nTente ser mais específico!`,
      chatId
    );
  }
  
  let response = `🔍 *Resultados para "${topic}":*\n\n`;
  
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    response += `${i + 1}. *${r.title}*\n`;
    response += `📰 ${r.source}\n`;
    response += `🔗 ${r.link}\n\n`;
  }
  
  response += `⚠️ *Verifique as fontes!* Acesse os links.\n`;
  response += `_Responda com o número (1-${results.length}) para mais detalhes_`;
  
  addToHistory(chatId, 'user', message);
  addToHistory(chatId, 'assistant', JSON.stringify(results));
  
  if (response.length > MAX_MESSAGE_LENGTH) {
    response = response.substring(0, MAX_MESSAGE_LENGTH - 100);
  }
  
  return await sendLongTelegram(response, chatId);
}

async function handleNewsRequest(chatId, message, name) {
  const topic = message
    .replace(/notícia|noticias|novidade|últimas|sobre/gi, '')
    .trim() || 'geral';
  
  await sendLongTelegram(`📰 Buscando notícias sobre "${topic}"...`, chatId);
  
  const results = await searchTopic(topic, 3);
  
  if (results.length === 0) {
    return await sendLongTelegram(
      `😕 Não encontrei notícias sobre "${topic}".`,
      chatId
    );
  }
  
  let response = `📰 *Últimas notícias sobre "${topic}":*\n\n`;
  
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    response += `${i + 1}. *${r.title}*\n`;
    response += `📰 ${r.source}\n`;
    response += `🔗 ${r.link}\n\n`;
  }
  
  response += `⚠️ *Verifique as fontes!* Acesse os links.\n`;
  response += `_Responda com o número (1-${results.length}) para mais detalhes_`;
  
  addToHistory(chatId, 'user', message);
  addToHistory(chatId, 'assistant', JSON.stringify(results));
  
  if (response.length > MAX_MESSAGE_LENGTH) {
    response = response.substring(0, MAX_MESSAGE_LENGTH - 100);
  }
  
  return await sendLongTelegram(response, chatId);
}

export async function handleNewsDetail(chatId, index, name) {
  const history = conversationHistory.get(chatId);
  if (!history) return null;
  
  let lastResults = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      try {
        lastResults = JSON.parse(history[i].content);
        if (Array.isArray(lastResults)) break;
      } catch {
        continue;
      }
    }
  }
  
  if (!lastResults || !Array.isArray(lastResults)) return null;
  
  const itemIndex = parseInt(index) - 1;
  if (itemIndex < 0 || itemIndex >= lastResults.length) {
    await sendTelegram(`❌ Número inválido. Escolha entre 1 e ${lastResults.length}.`, chatId);
    return true;
  }
  
  const r = lastResults[itemIndex];
  
  await sendLongTelegram(
    `📰 *${r.title}*\n\n` +
    `📰 Fonte: ${r.source}\n` +
    `🔗 ${r.link}\n\n` +
    `📝 *Resumo:*\n${r.snippet}\n\n` +
    `⚠️ *Verifique a notícia na fonte original!*`,
    chatId
  );
  
  return true;
}

async function handleGeneralChat(chatId, message, name) {
  addToHistory(chatId, 'user', message);
  
  const context = buildContext(chatId);
  
  const systemPrompt = `Você é um assistente útil em português brasileiro. 
O usuário ${name} está conversando com você.
Histórico recente:
${context || 'Nenhuma mensagem anterior'}

Instruções:
- Responda de forma clara e amigável
- Mantenha respostas curtas (máximo 3 parágrafos)
- Use emoji quando apropriado`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt: `${systemPrompt}\n\nUsuário: ${message}\nAssistente:`,
      options: { temperature: 0.7, num_predict: 400 }
    });

    const reply = response.response.trim();
    
    addToHistory(chatId, 'assistant', reply);
    
    return await sendLongTelegram(reply, chatId);
  } catch (err) {
    console.error('❌ Erro no chat Ollama:', err.message);
    return await sendLongTelegram(
      '😕 Desculpe, estou com problemas técnicos.',
      chatId
    );
  }
}
