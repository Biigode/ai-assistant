// src/chat.js
// Orquestra o chat: intent detection → busca → análise → resposta

import { sendLongTelegram, sendTelegram } from './telegram/telegram.js';
import { searchTopic } from './digest/search.js';
import { analyzeProduct, analyzeContent, analyzeNews, analyzeGeneral } from './ai/analysis.js';
import { classifyIntent, generateChatResponse, extractSearchQuery } from './ai/llm.js';
import { addMessage, getHistory, buildContextString } from './core/memory.js';
import { runResearchPipeline } from './ai/agents.js';

export async function analyzeUserIntent(message, chatId, userInterests = []) {
  const lower = message.toLowerCase().trim();

  const greetings = ['olá','ola','oi','ei','eai','hi','hello','bom dia','boa tarde','boa noite'];
  if (greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower === g + '!')) {
    return { needsSearch: false, analysisType: 'greeting', searchQuery: '' };
  }

  const profileTerms = ['meu perfil','meus interesses','meu digest','sobre mim','minha conta'];
  if (profileTerms.some(p => lower.includes(p))) {
    return { needsSearch: false, analysisType: 'profile', searchQuery: '' };
  }

  const researchTerms = ['pesquisa profunda','investigar','investigação','briefing','roteiro','vídeo sobre','video sobre','analisar fundo'];
  if (researchTerms.some(p => lower.includes(p))) {
    return { needsSearch: true, analysisType: 'research', searchQuery: message };
  }

  try {
    const intent = await classifyIntent(message);
    if (intent === 'chat') return { needsSearch: false, analysisType: 'chat', searchQuery: '' };
    const analysisType = detectAnalysisType(lower);
    const searchQuery  = await buildSearchQuery(message, userInterests, analysisType);
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

async function buildSearchQuery(message, userInterests, analysisType) {
  if (analysisType === 'news' && userInterests.length > 0) {
    const q = userInterests.slice(0, 3).join(' ');
    console.log(`   📌 Usando interesses do usuário: "${q}"`);
    return q;
  }
  if (message.trim().length <= 40) return message.trim();
  try {
    const q = await extractSearchQuery(message);
    console.log(`   🔍 Query extraída: "${q}"`);
    return q;
  } catch {
    return message.split(' ').filter(w => w.length > 3).slice(0, 5).join(' ');
  }
}

export async function handleChatMessage(chatId, message, name) {
  console.log(`💬 Chat de ${name} (${chatId}): "${message}"`);
  await addMessage(chatId, 'user', message);

  const { findUserByChatId } = await import('../models/UserPreferences.js');
  const user = await findUserByChatId(chatId);
  const userInterests = user?.interests?.filter(i => i.active).map(i => i.topic) || [];

  const intent = await analyzeUserIntent(message, chatId, userInterests);
  console.log(`   Intent: type=${intent.analysisType}, query="${intent.searchQuery}"`);

  switch (intent.analysisType) {
    case 'greeting': return handleGreeting(chatId, name, user);
    case 'profile':  return handleProfileQuery(chatId, name, user);
    case 'research': return handleResearch(chatId, message, name);
  }

  if (intent.needsSearch) return smartSearch(chatId, message, intent.searchQuery, intent.analysisType);
  return handleGeneralChat(chatId, message, name);
}

async function handleResearch(chatId, message, name) {
  await sendLongTelegram(`🔬 Iniciando investigação profunda...\nIsso pode levar 1-2 minutos!`, chatId);
  const topic = message.replace(/pesquisa profunda|investigar|investigação|briefing|roteiro|vídeo sobre|video sobre|analisar fundo/gi, '').trim() || message;
  try {
    const result = await runResearchPipeline(topic);
    await addMessage(chatId, 'assistant', result.briefing);
    return sendLongTelegram(result.briefing, chatId);
  } catch (err) {
    return sendLongTelegram(`❌ Erro na investigação: ${err.message}`, chatId);
  }
}

async function smartSearch(chatId, userMessage, query, analysisType) {
  const labels = { product: '🛒 Buscando produto...', content: '🎬 Buscando conteúdo...', news: '📰 Buscando notícias...', general: '🔍 Buscando...' };
  await sendLongTelegram(labels[analysisType] || '🔍 Buscando...', chatId);

  let results = await searchTopic(query, 5);
  if (!results.length) {
    const fallback = query.split(' ').slice(0, 3).join(' ');
    results = await searchTopic(fallback, 5);
    if (!results.length) {
      return sendLongTelegram(`😕 Não encontrei resultados para "${query}".`, chatId);
    }
  }

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
  results.forEach((r, i) => { msg += `${i + 1}. ${r.title}\n   📰 ${r.source}\n\n`; });
  msg += `Digite o número (1-${results.length}) para ler o resumo.\n`;
  msg += `Ou: "pesquisa profunda [tema]" para briefing completo!`;
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
  await sendLongTelegram(`📰 ${r.title}\n\n📰 Fonte: ${r.source}\n🔗 ${r.link}\n\n📝 Resumo:\n${r.snippet}\n\n⚠️ Verifique na fonte original!`, chatId);
  return true;
}

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
    msg += `📰 Notícias → "últimas notícias de IA"\n🔬 Briefing → "pesquisa profunda [tema]"\n🛒 Produtos → "melhor notebook"\n⚙️ Ajustes → /perfil`;
  } else {
    msg += `Bem-vindo ao Daily Digest Bot!\n\n📰 Resumo diário · 🔬 Briefings para vídeos · 🔍 Buscas\n\nConfigure seus interesses: /configurar`;
  }
  return sendLongTelegram(msg, chatId);
}

async function handleProfileQuery(chatId, name, user) {
  const interests = user?.interests?.filter(i => i.active).map(i => i.topic) || [];
  if (!interests.length) return sendLongTelegram(`📋 Sem interesses configurados ainda.\nUse /configurar para começar!`, chatId);
  const settings = user?.digestSettings || {};
  return sendLongTelegram(`📋 Seu Perfil\n\n📛 Nome: ${user.name}\n📌 Interesses: ${interests.join(', ')}\n⏰ Horário: ${settings.cronSchedule || '08:00'}\n📝 Estilo: ${settings.summaryStyle || 'bullet-points'}`, chatId);
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/^#+\s*/gm, '').trim();
}

function indicatesNoAccess(text) {
  return ['não tenho acesso','informações em tempo real','pesquise em'].some(p => text.toLowerCase().includes(p));
}

function buildFallbackList(results, query) {
  let msg = `📰 Resultados encontrados:\n\n`;
  results.forEach((r, i) => { msg += `${i+1}. ${r.title}\n   📰 ${r.source}\n   🔗 ${r.link}\n\n`; });
  return msg;
}
