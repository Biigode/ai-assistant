// src/chat.js
// Chat refatorado com memória persistente e intent classification via LLM

import { sendLongTelegram, sendTelegram } from './telegram.js';
import { searchTopic } from './search.js';
import { analyzeProduct, analyzeContent, analyzeNews, analyzeGeneral } from './analysis.js';
import { classifyIntent, generateChatResponse, extractSearchQuery } from './llm.js';
import { addMessage, getHistory, buildContextString } from './memory.js';
import { runResearchPipeline } from './agents.js';

export async function analyzeUserIntent(message, chatId, userInterests = []) {
  const lower = message.toLowerCase().trim();

  // Saudações — sem LLM
  const greetings = ['olá','ola','oi','ei','eai','hi','hello','bom dia','boa tarde','boa noite'];
  if (greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower === g + '!')) {
    return { needsSearch: false, analysisType: 'greeting', searchQuery: '' };
  }

  // Perfil — sem LLM
  const profileTerms = ['meu perfil','meus interesses','meu digest','sobre mim','minha conta'];
  if (profileTerms.some(p => lower.includes(p))) {
    return { needsSearch: false, analysisType: 'profile', searchQuery: '' };
  }

  // Pesquisa profunda (pipeline de agentes)
  const researchTerms = ['pesquisa profunda','investigar','investigação','briefing','roteiro','vídeo sobre','video sobre','analisar fundo'];
  if (researchTerms.some(p => lower.includes(p))) {
    return { needsSearch: true, analysisType: 'research', searchQuery: message };
  }

  try {
    const intent = await classifyIntent(message);
    if (intent === 'chat') return { needsSearch: false, analysisType: 'chat', searchQuery: '' };

    const analysisType = detectAnalysisType(lower);

    // Sempre extrai uma query curta e limpa — nunca envia a mensagem crua para o DuckDuckGo
    const searchQuery = await buildSearchQuery(message, userInterests, analysisType);

    return { needsSearch: true, analysisType, searchQuery };
  } catch {
    return { needsSearch: false, analysisType: 'chat', searchQuery: '' };
  }
}

function detectAnalysisType(lower) {
  if (['vídeo','video','youtube','conteúdo','conteudo','ideia','ideias'].some(p => lower.includes(p))) return 'content';
  if (['comprar','melhor','preço','produto','notebook','celular','tv','mouse','teclado'].some(p => lower.includes(p))) return 'product';
  if (['notícia','noticias','novidade','resumo','últimas','bombando','em alta'].some(p => lower.includes(p))) return 'news';
  return 'general';
}

// Extrai uma query curta e específica da mensagem do usuário
// Prioridade: interesses do usuário > extração via LLM > fallback com primeiras palavras
async function buildSearchQuery(message, userInterests, analysisType) {
  // Para notícias: usa os interesses cadastrados como query base
  if (analysisType === 'news' && userInterests.length > 0) {
    // Combina interesses em query de busca
    const interestQuery = userInterests.slice(0, 3).join(' ');
    console.log(`   📌 Usando interesses do usuário como query: "${interestQuery}"`);
    return interestQuery;
  }

  // Para mensagens curtas, usa diretamente
  if (message.trim().length <= 40) return message.trim();

  // Para mensagens longas: extrai query via LLM
  try {
    const query = await extractSearchQuery(message);
    console.log(`   🔍 Query extraída pelo LLM: "${query}"`);
    return query;
  } catch {
    // Fallback: pega as primeiras 5 palavras relevantes
    const words = message.split(' ').filter(w => w.length > 3).slice(0, 5);
    return words.join(' ');
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

export async function handleChatMessage(chatId, message, name) {
  console.log(`💬 Chat de ${name} (${chatId}): "${message}"`);
  await addMessage(chatId, 'user', message);

  const { findUserByChatId } = await import('../models/UserPreferences.js');
  const user = await findUserByChatId(chatId);
  const userInterests = user?.interests?.filter(i => i.active).map(i => i.topic) || [];

  const intent = await analyzeUserIntent(message, chatId, userInterests);
  console.log(`   Intent: needsSearch=${intent.needsSearch}, type=${intent.analysisType}, query="${intent.searchQuery}"`);

  switch (intent.analysisType) {
    case 'greeting': return handleGreeting(chatId, name, user);
    case 'profile':  return handleProfileQuery(chatId, name, user);
    case 'research': return handleResearch(chatId, message, name);
  }

  if (intent.needsSearch) {
    return smartSearch(chatId, message, intent.searchQuery, intent.analysisType);
  }

  return handleGeneralChat(chatId, message, name);
}

// ─── Pipeline de pesquisa profunda (agentes) ──────────────────────────────────

async function handleResearch(chatId, message, name) {
  await sendLongTelegram(
    `🔬 Iniciando investigação profunda...\nIsso pode levar 1-2 minutos.\n\nVou buscar múltiplas fontes, cruzar informações e gerar um briefing completo para seu vídeo!`,
    chatId
  );

  const topic = message
    .replace(/pesquisa profunda|investigar|investigação|briefing|roteiro|vídeo sobre|video sobre|analisar fundo/gi, '')
    .trim() || message;

  try {
    const result = await runResearchPipeline(topic);
    await addMessage(chatId, 'assistant', result.briefing);
    return sendLongTelegram(result.briefing, chatId);
  } catch (err) {
    return sendLongTelegram(`❌ Erro na investigação: ${err.message}\n\nTente novamente com /buscar ${topic}`, chatId);
  }
}

// ─── Busca simples ────────────────────────────────────────────────────────────

async function smartSearch(chatId, userMessage, query, analysisType) {
  const labels = {
    product: '🛒 Buscando produto...',
    content: '🎬 Buscando ideias de conteúdo...',
    news:    '📰 Buscando notícias...',
    general: '🔍 Buscando...'
  };
  await sendLongTelegram(labels[analysisType] || '🔍 Buscando...', chatId);

  const results = await searchTopic(query, 5);

  if (results.length === 0) {
    // Tenta uma segunda vez com query ainda mais simples
    const fallbackQuery = query.split(' ').slice(0, 3).join(' ');
    console.log(`   ↩ Tentando query simplificada: "${fallbackQuery}"`);
    const retryResults = await searchTopic(fallbackQuery, 5);

    if (retryResults.length === 0) {
      return sendLongTelegram(
        `😕 Não encontrei resultados para "${query}".\n\nTente usar termos mais simples, como:\n"notícias inteligência artificial" ou "novidades programação"`,
        chatId
      );
    }
    return processSearchResults(chatId, userMessage, retryResults, analysisType);
  }

  return processSearchResults(chatId, userMessage, results, analysisType);
}

async function processSearchResults(chatId, userMessage, results, analysisType) {
  if (analysisType === 'news') return showNewsList(chatId, results, userMessage);

  let analysis;
  switch (analysisType) {
    case 'product': analysis = await analyzeProduct(results, userMessage); break;
    case 'content': analysis = await analyzeContent(results, userMessage); break;
    default:        analysis = await analyzeGeneral(results, userMessage);
  }

  analysis = cleanText(analysis);
  if (!analysis || indicatesNoAccess(analysis)) analysis = buildFallbackList(results, userMessage);

  await addMessage(chatId, 'assistant', analysis);
  return sendLongTelegram(`🔍 Resultado:\n\n${analysis}\n\nVerifique as fontes originais.`, chatId);
}

async function showNewsList(chatId, results, query) {
  let msg = `📰 Notícias encontradas\n\n`;
  results.forEach((r, i) => {
    msg += `${i + 1}. ${r.title}\n   📰 ${r.source}\n\n`;
  });
  msg += `Digite o número (1-${results.length}) para ler o resumo.\n`;
  msg += `Ou: "pesquisa profunda [tema]" para briefing completo de vídeo!`;

  await addMessage(chatId, 'assistant', JSON.stringify(results));
  return sendLongTelegram(msg, chatId);
}

export async function handleNewsDetail(chatId, index, name) {
  const history = await getHistory(chatId);
  let lastResults = null;

  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      try {
        const parsed = JSON.parse(history[i].content);
        if (Array.isArray(parsed)) { lastResults = parsed; break; }
      } catch { continue; }
    }
  }

  if (!lastResults) return null;

  const idx = parseInt(index) - 1;
  if (idx < 0 || idx >= lastResults.length) {
    await sendTelegram(`❌ Número inválido. Escolha entre 1 e ${lastResults.length}.`, chatId);
    return true;
  }

  const r = lastResults[idx];
  await sendLongTelegram(
    `📰 ${r.title}\n\n📰 Fonte: ${r.source}\n🔗 ${r.link}\n\n📝 Resumo:\n${r.snippet}\n\n⚠️ Verifique na fonte original!`,
    chatId
  );
  return true;
}

// ─── Chat geral ───────────────────────────────────────────────────────────────

async function handleGeneralChat(chatId, message, name) {
  const context = await buildContextString(chatId);
  const reply = await generateChatResponse(message, null, { name, context });
  await addMessage(chatId, 'assistant', reply);
  return sendLongTelegram(reply, chatId);
}

async function handleGreeting(chatId, name, user) {
  const interests = user?.interests?.filter(i => i.active).map(i => i.topic) || [];
  let msg = `Olá ${name}! 👋\n\n`;

  if (interests.length > 0) {
    msg += `Seus interesses: ${interests.join(', ')}\n\n`;
    msg += `O que posso fazer:\n`;
    msg += `📰 Notícias → "últimas notícias de IA"\n`;
    msg += `🔬 Briefing para vídeo → "pesquisa profunda [tema]"\n`;
    msg += `🛒 Produtos → "melhor notebook para programar"\n`;
    msg += `⚙️ Ajustes → /perfil ou /configurar`;
  } else {
    msg += `Bem-vindo ao Daily Digest Bot!\n\n`;
    msg += `📰 Resumo diário de notícias\n`;
    msg += `🔬 Briefings completos para vídeos\n`;
    msg += `🔍 Buscas inteligentes\n\n`;
    msg += `Configure seus interesses: /configurar`;
  }

  return sendLongTelegram(msg, chatId);
}

async function handleProfileQuery(chatId, name, user) {
  const interests = user?.interests?.filter(i => i.active).map(i => i.topic) || [];

  if (interests.length === 0) {
    return sendLongTelegram(`📋 Sem interesses configurados ainda.\nUse /configurar para começar!`, chatId);
  }

  const settings = user?.digestSettings || {};
  const msg = `📋 Seu Perfil\n\n📛 Nome: ${user.name}\n📌 Interesses: ${interests.join(', ')}\n⏰ Horário: ${settings.cronSchedule || '08:00'}\n📝 Estilo: ${settings.summaryStyle || 'bullet-points'}`;
  return sendLongTelegram(msg, chatId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();
}

function indicatesNoAccess(text) {
  return ['não tenho acesso','informações em tempo real','pesquise em'].some(p =>
    text.toLowerCase().includes(p)
  );
}

function buildFallbackList(results, query) {
  let msg = `📰 Resultados encontrados:\n\n`;
  results.forEach((r, i) => {
    msg += `${i+1}. ${r.title}\n   📰 ${r.source}\n   🔗 ${r.link}\n\n`;
  });
  return msg;
}
