// src/chat.js
// Chatbot conversacional com Ollama e busca inteligente

import { Ollama } from 'ollama';
import { sendLongTelegram, sendTelegram } from './telegram.js';
import { searchTopic } from './search.js';
import { analyzeProduct, analyzeContent, analyzeNews, analyzeGeneral } from './analysis.js';

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

export async function analyzeUserIntent(message) {
  const lower = message.toLowerCase();
  
  const forceSearchPhrases = [
    'buscar', 'procurar', 'pesquisar', 'busca', 'procure', 'pesquise',
    'internet', 'na internet', 'web',
    'notícia', 'noticias', 'novidade', 'atualização',
    'tendencia', 'tendências', 'bombando', 'em alta',
    'o que está', 'quais são', 'me passe',
    'atualizado', 'atualizadas'
  ];
  
  const forceSearch = forceSearchPhrases.some(p => lower.includes(p));
  
  const contentPhrases = [
    'vídeo', 'video', 'youtube', 'criar', 'conteúdo', 'conteudo',
    'programador', 'developer', 'dev', 'código', 'codigo',
    'ideia', 'ideias', 'tema', 'temas', 'assunto', 'assuntos'
  ];
  
  const productPhrases = [
    'comprar', 'melhor', 'preço', 'valor', 'qual', 'produto',
    'tv', 'celular', 'notebook', 'computador', 'câmera', 'camera',
    'headphone', 'fone', 'mouse', 'teclado'
  ];

  let analysisType = 'general';
  
  if (contentPhrases.some(p => lower.includes(p))) {
    analysisType = 'content';
  } else if (productPhrases.some(p => lower.includes(p))) {
    analysisType = 'product';
  } else if (lower.includes('notícia') || lower.includes('noticia') || lower.includes('novidade')) {
    analysisType = 'news';
  }

  if (!forceSearch && !analysisType) {
    return { needsSearch: false, searchQuery: '', analysisType: 'general' };
  }

  const prompt = `Gere uma query de busca boa para encontrar informações relevantes.

Regras:
- searchQuery: query curta (3-6 palavras) em português
- analysisType: "product" | "content" | "news" | "general"
- analysisType content = para criar vídeos, ideias para YouTube
- analysisType news = notícias, tendências atuais

Mensagem: "${message}"

Retorne JSON: {"searchQuery": "...", "analysisType": "..."}`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.1, num_predict: 150 }
    });

    const raw = response.response.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    
    if (match) {
      const result = JSON.parse(match[0]);
      return {
        needsSearch: true,
        searchQuery: result.searchQuery || message,
        analysisType: result.analysisType || analysisType
      };
    }
  } catch (err) {
    console.error('❌ Erro ao analisar intent:', err.message);
  }

  return {
    needsSearch: true,
    searchQuery: message,
    analysisType
  };
}

export async function handleChatMessage(chatId, message, name) {
  console.log(`💬 Chat de ${name} (${chatId}): "${message}"`);
  
  const intent = await analyzeUserIntent(message);
  console.log(`   Intent: needsSearch=${intent.needsSearch}, type=${intent.analysisType}, query="${intent.searchQuery}"`);

  if (intent.needsSearch) {
    return await smartSearch(chatId, message, intent.searchQuery, intent.analysisType, name);
  }

  return await handleGeneralChat(chatId, message, name);
}

function indicatesNoAccess(response) {
  const lower = response.toLowerCase();
  const phrases = [
    'não tenho acesso',
    'não posso acessar',
    'não tenho informação',
    'não tenho dados',
    'sem acesso',
    'informações em tempo real',
    'atualizar meus dados',
    'base de dados',
    'não foi possível encontrar',
    'não encontrei',
    'pesquise em',
    'visite o site'
  ];
  return phrases.some(p => lower.includes(p));
}

function cleanMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*\+\s+/gm, '')
    .replace(/^#+\s*/gm, '')
    .trim();
}

function looksLikeGenericResults(analysis, results) {
  if (!analysis || results.length === 0) return true;
  const lower = analysis.toLowerCase();
  if (lower.includes('opções') && lower.includes('melhor opção') && !results.some(r => 
    analysis.toLowerCase().includes(r.title.toLowerCase().substring(0, 20))
  )) {
    return true;
  }
  return false;
}

async function smartSearch(chatId, userMessage, query, analysisType, name) {
  const typeLabels = {
    product: '🛒 Análise de Produto',
    content: '🎬 Ideias para Conteúdo',
    news: '📰 Resumo de Notícias',
    general: '🔍 Informação'
  };

  await sendLongTelegram(`${typeLabels[analysisType] || '🔍'} Buscando informações...`, chatId);

  let results = await searchTopic(query, 5);

  if (results.length === 0) {
    return await sendLongTelegram(
      `😕 Não encontrei informações sobre "${query}".\n\nTente ser mais específico!`,
      chatId
    );
  }

  addToHistory(chatId, 'user', userMessage);

  let analysis;
  switch (analysisType) {
    case 'product':
      analysis = await analyzeProduct(results, userMessage);
      break;
    case 'content':
      analysis = await analyzeContent(results, userMessage);
      break;
    case 'news':
      analysis = await analyzeNews(results, userMessage);
      break;
    default:
      analysis = await analyzeGeneral(results, userMessage);
  }

  if (looksLikeGenericResults(analysis, results)) {
    console.log('🔄 Resultados genéricos, tentando novamente com query mais específica...');
    const retryQuery = query + ' 2026 Brasil';
    results = await searchTopic(retryQuery, 5);
    
    if (results.length > 0) {
      switch (analysisType) {
        case 'product':
          analysis = await analyzeProduct(results, userMessage);
          break;
        case 'content':
          analysis = await analyzeContent(results, userMessage);
          break;
        case 'news':
          analysis = await analyzeNews(results, userMessage);
          break;
        default:
          analysis = await analyzeGeneral(results, userMessage);
      }
    }
  }

  analysis = cleanMarkdown(analysis);

  if (!analysis || indicatesNoAccess(analysis)) {
    let fallback = `📰 Resultados para "${userMessage}":\n\n`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      fallback += `${i + 1}. ${r.title}\n`;
      fallback += `   Fonte: ${r.source}\n`;
      fallback += `   ${r.link}\n\n`;
    }
    fallback += `Verifique as informações nos links acima.`;
    analysis = fallback;
  }

  const response = `🔍 Resultado da busca:\n\n${analysis}\n\nVerifique as informacoes nas fontes originais`;

  addToHistory(chatId, 'assistant', analysis);

  if (response.length > MAX_MESSAGE_LENGTH) {
    return await sendLongTelegram(response, chatId);
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
    `📰 ${r.title}\n\n` +
    `📰 Fonte: ${r.source}\n` +
    `🔗 ${r.link}\n\n` +
    `📝 Resumo:\n${r.snippet}\n\n` +
    `⚠️ Verifique a noticia na fonte original!`,
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
- Use emoji quando apropriado
- Se precisar de informações atualizadas, diga que pode buscar para você`;

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
