// src/telegram-polling.js
// Polling do Telegram — processa mensagens de texto E cliques em botões (callback_query)

import fetch from 'node-fetch';
import { handleChatMessage, handleNewsDetail } from './chat.js';
import { handleCommand, handleInteractiveResponse } from './telegram-commands.js';
import { sendWithButtons, sendLongTelegram, sendTelegram, answerCallback, editMessage } from './telegram.js';
import { menuPrincipal, menuPesquisa, menuConfig, menuHorario, menuEstilo, menuNoticias } from './menus.js';
import { runDigestForAll } from './digest.js';
import { runResearchPipeline } from './agents.js';
import { searchTopic } from './search.js';

const TELEGRAM_API = 'https://api.telegram.org';
let offset = 0;
let isRunning = false;
let botToken = null;

// Estado dos usuários em fluxo interativo (digitar tema de pesquisa, etc.)
const interactiveUsers = new Map();
// Cache temporário de resultados de notícias por chatId
const newsCache = new Map();

export async function startPolling(token) {
  if (isRunning) return;
  isRunning = true;
  botToken = token;
  console.log('🔄 Polling do Telegram iniciado...');

  while (isRunning) {
    try {
      const updates = await getUpdates(token);
      for (const update of updates) {
        await processUpdate(update, token).catch(err =>
          console.error('❌ Erro ao processar update:', err.message)
        );
        offset = update.update_id + 1;
      }
    } catch (err) {
      console.error('❌ Erro no polling:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

export function stopPolling() { isRunning = false; }

async function getUpdates(token) {
  const url = `${TELEGRAM_API}/bot${token}/getUpdates?timeout=30&offset=${offset}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.description);
  return body.result;
}

// ─── Roteador principal ───────────────────────────────────────────────────────

async function processUpdate(update, token) {

  // Clique em botão inline
  if (update.callback_query) {
    await processCallback(update.callback_query, token);
    return;
  }

  // Mensagem de texto normal
  if (!update.message?.text) return;

  const chatId = update.message.chat.id.toString();
  const text   = update.message.text.trim();
  const name   = update.message.chat.first_name || 'Usuário';

  console.log(`💬 ${name} (${chatId}): ${text}`);

  const currentStep = interactiveUsers.get(chatId);

  // Fluxo interativo pendente (ex: usuário digitando tema de pesquisa)
  if (currentStep?.step) {
    const { findUserByChatId } = await import('../models/UserPreferences.js');
    const user = await findUserByChatId(chatId);
    const result = await handleInteractiveStep(chatId, text, name, user, token, currentStep);
    if (result?.step) interactiveUsers.set(chatId, result);
    else interactiveUsers.delete(chatId);
    return;
  }

  // Comando /
  if (text.startsWith('/')) {
    const cmd = text.split(' ')[0].toLowerCase();
    await handleTextCommand(chatId, cmd, text, name, token);
    return;
  }

  // Número (seleção de notícia da lista)
  if (/^[1-9]$/.test(text)) {
    const handled = await handleNewsDetail(chatId, text, name);
    if (handled) return;
  }

  // Conversa livre
  await handleChatMessage(chatId, text, name);
}

// ─── Comandos de texto ────────────────────────────────────────────────────────

async function handleTextCommand(chatId, cmd, fullText, name, token) {
  const { findUserByChatId } = await import('../models/UserPreferences.js');
  const user = await findUserByChatId(chatId);

  switch (cmd) {
    case '/start':
    case '/menu': {
      const menu = menuPrincipal(name);
      await sendWithButtons(menu.text, chatId, menu.buttons, token);
      break;
    }
    case '/noticias':
      await processNoticias(chatId, user, token);
      break;
    case '/digest':
      await processDigest(chatId, name, token);
      break;
    case '/perfil':
    case '/profile':
      await processProfile(chatId, user, token);
      break;
    case '/adicionar':
    case '/add':
      await sendTelegram('➕ Qual interesse deseja adicionar?\nEx: "Machine Learning", "Cloud Computing"', chatId, token);
      interactiveUsers.set(chatId, { step: 'add_interest' });
      break;
    case '/remover':
    case '/remove':
      await processRemover(chatId, user, token);
      break;
    case '/horario':
    case '/schedule': {
      const menu = menuHorario();
      await sendWithButtons(menu.text, chatId, menu.buttons, token);
      break;
    }
    case '/estilo':
    case '/style': {
      const menu = menuEstilo();
      await sendWithButtons(menu.text, chatId, menu.buttons, token);
      break;
    }
    case '/help':
    case '/ajuda':
      await processAjuda(chatId, token);
      break;
    default: {
      // Tenta o handler legado para compatibilidade
      const result = await handleCommand(chatId, cmd, token);
      if (result?.step) interactiveUsers.set(chatId, result);
    }
  }
}

// ─── Processador de callbacks (cliques nos botões) ────────────────────────────

async function processCallback(callbackQuery, token) {
  const chatId    = callbackQuery.message.chat.id.toString();
  const msgId     = callbackQuery.message.message_id;
  const name      = callbackQuery.from.first_name || 'Usuário';
  const data      = callbackQuery.data;
  const queryId   = callbackQuery.id;

  console.log(`🔘 Botão: ${name} (${chatId}) → "${data}"`);

  const { findUserByChatId } = await import('../models/UserPreferences.js');
  const user = await findUserByChatId(chatId);

  // ── Navegação entre menus ──────────────────────────────────────────────────

  if (data === 'menu:principal') {
    await answerCallback(queryId, '', token);
    const menu = menuPrincipal(name);
    await editMessage(chatId, msgId, menu.text, menu.buttons, token);
    return;
  }

  if (data === 'menu:pesquisa') {
    await answerCallback(queryId, '', token);
    const interests = user?.interests?.filter(i => i.active).map(i => i.topic) || [];
    const menu = menuPesquisa(interests);
    await editMessage(chatId, msgId, menu.text, menu.buttons, token);
    return;
  }

  if (data === 'menu:config') {
    await answerCallback(queryId, '', token);
    const menu = menuConfig();
    await editMessage(chatId, msgId, menu.text, menu.buttons, token);
    return;
  }

  if (data === 'menu:horario') {
    await answerCallback(queryId, '', token);
    const menu = menuHorario();
    await editMessage(chatId, msgId, menu.text, menu.buttons, token);
    return;
  }

  if (data === 'menu:estilo') {
    await answerCallback(queryId, '', token);
    const menu = menuEstilo();
    await editMessage(chatId, msgId, menu.text, menu.buttons, token);
    return;
  }

  // ── Comandos diretos via botão ─────────────────────────────────────────────

  if (data === 'cmd:noticias') {
    await answerCallback(queryId, '📰 Buscando notícias...', token);
    await processNoticias(chatId, user, token);
    return;
  }

  if (data === 'cmd:digest') {
    await answerCallback(queryId, '📦 Gerando digest...', token);
    await processDigest(chatId, name, token);
    return;
  }

  if (data === 'cmd:perfil') {
    await answerCallback(queryId, '', token);
    await processProfile(chatId, user, token);
    return;
  }

  if (data === 'cmd:ajuda') {
    await answerCallback(queryId, '', token);
    await processAjuda(chatId, token);
    return;
  }

  if (data === 'cmd:adicionar') {
    await answerCallback(queryId, '', token);
    await sendTelegram('➕ Qual interesse deseja adicionar?\nEx: "Machine Learning", "Cloud Computing"', chatId, token);
    interactiveUsers.set(chatId, { step: 'add_interest' });
    return;
  }

  if (data === 'cmd:remover') {
    await answerCallback(queryId, '', token);
    await processRemover(chatId, user, token);
    return;
  }

  // ── Horário selecionado ────────────────────────────────────────────────────

  if (data.startsWith('horario:')) {
    const cron = data.replace('horario:', '');
    if (cron === 'custom') {
      await answerCallback(queryId, '', token);
      await sendTelegram('⏰ Digite o horário desejado (ex: 09:00 ou 15:30):', chatId, token);
      interactiveUsers.set(chatId, { step: 'horario_custom' });
      return;
    }
    await answerCallback(queryId, '✅ Horário atualizado!', token);
    await salvarHorario(chatId, user, cron, token);
    return;
  }

  // ── Estilo selecionado ─────────────────────────────────────────────────────

  if (data.startsWith('estilo:')) {
    const estilo = data.replace('estilo:', '');
    await answerCallback(queryId, '✅ Estilo atualizado!', token);
    await salvarEstilo(chatId, user, estilo, token);
    return;
  }

  // ── Pesquisa profunda ──────────────────────────────────────────────────────

  if (data.startsWith('research:')) {
    const tema = data.replace('research:', '');
    if (tema === 'custom') {
      await answerCallback(queryId, '', token);
      await sendTelegram('🔬 Digite o tema para pesquisa profunda:', chatId, token);
      interactiveUsers.set(chatId, { step: 'research_custom' });
      return;
    }
    await answerCallback(queryId, `🔬 Investigando ${tema}...`, token);
    await processResearch(chatId, tema, token);
    return;
  }

  // ── Notícia selecionada da lista ───────────────────────────────────────────

  if (data.startsWith('noticia:')) {
    const idx = parseInt(data.replace('noticia:', '')) + 1;
    await answerCallback(queryId, '📰 Carregando...', token);
    await handleNewsDetail(chatId, idx.toString(), name);
    return;
  }

  // Fallback
  await answerCallback(queryId, '⚠️ Ação não reconhecida', token);
}

// ─── Fluxos interativos (quando usuário precisa digitar algo) ─────────────────

async function handleInteractiveStep(chatId, text, name, user, token, currentStep) {
  const { createOrUpdateUser } = await import('../models/UserPreferences.js');
  const { extractInterests } = await import('./llm.js');

  switch (currentStep.step) {

    case 'add_interest': {
      let topics;
      try { topics = await extractInterests(text); }
      catch { topics = text.split(',').map(t => t.trim()).filter(Boolean); }

      const newInterests = [...(user?.interests || [])];
      for (const t of topics) {
        if (!newInterests.find(i => i.topic.toLowerCase() === t.toLowerCase())) {
          newInterests.push({ topic: t, active: true });
        }
      }
      await createOrUpdateUser({ ...user, telegramChatId: chatId, interests: newInterests });

      const menu = menuPrincipal(name);
      await sendWithButtons(
        `✅ Adicionado: ${topics.join(', ')}\n\nSeus interesses: ${newInterests.filter(i => i.active).map(i => i.topic).join(', ')}`,
        chatId, menu.buttons, token
      );
      return null;
    }

    case 'research_custom': {
      await processResearch(chatId, text, token);
      return null;
    }

    case 'horario_custom': {
      const match = text.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) {
        await sendTelegram('❌ Formato inválido. Use HH:MM, ex: 09:00', chatId, token);
        return currentStep;
      }
      const cron = `0 ${parseInt(match[1])} * * *`;
      await salvarHorario(chatId, user, cron, token);
      return null;
    }

    default:
      return await handleInteractiveResponse(chatId, text, user, token, currentStep);
  }
}

// ─── Ações de negócio ─────────────────────────────────────────────────────────

async function processNoticias(chatId, user, token) {
  const interests = user?.interests?.filter(i => i.active).map(i => i.topic) || [];

  if (!interests.length) {
    const menu = menuPrincipal();
    await sendWithButtons(
      '⚠️ Você não tem interesses configurados.\nUse ⚙️ Configurações para adicionar!',
      chatId, menu.buttons, token
    );
    return;
  }

  await sendTelegram('📰 Buscando notícias...', chatId, token);

  const query   = interests.slice(0, 3).join(', ');
  const results = await searchTopic(query, 5);

  if (!results.length) {
    await sendTelegram('😕 Não encontrei notícias agora. Tente novamente em instantes.', chatId, token);
    return;
  }

  // Salva no cache para o usuário poder clicar nos botões
  newsCache.set(chatId, results);

  const menu = menuNoticias(results, query);
  await sendWithButtons(menu.text, chatId, menu.buttons, token);
}

async function processDigest(chatId, name, token) {
  await sendTelegram(`📦 Gerando seu digest, ${name}...\nIsso pode levar alguns segundos.`, chatId, token);
  await runDigestForAll(chatId);
  const menu = menuPrincipal(name);
  await sendWithButtons('✅ Digest enviado! O que mais posso fazer?', chatId, menu.buttons, token);
}

async function processResearch(chatId, tema, token) {
  await sendLongTelegram(
    `🔬 Iniciando investigação profunda sobre "${tema}"...\nVou buscar múltiplas fontes e gerar um briefing completo para seu vídeo!`,
    chatId, token
  );

  try {
    const result = await runResearchPipeline(tema);
    await sendLongTelegram(result.briefing, chatId, token);
  } catch (err) {
    await sendTelegram(`❌ Erro na investigação: ${err.message}`, chatId, token);
  }

  const menu = menuPrincipal();
  await sendWithButtons('O que mais posso fazer?', chatId, menu.buttons, token);
}

async function processProfile(chatId, user, token) {
  if (!user) {
    const menu = menuConfig();
    await sendWithButtons('⚠️ Perfil não configurado ainda.', chatId, menu.buttons, token);
    return;
  }

  const interests = user.interests?.filter(i => i.active).map(i => i.topic) || [];
  const settings  = user.digestSettings || {};

  const msg = `👤 Seu Perfil\n\n` +
    `📛 Nome: ${user.name}\n` +
    `📌 Interesses (${interests.length}): ${interests.join(', ') || 'nenhum'}\n` +
    `⏰ Horário: ${settings.cronSchedule || '0 8 * * *'}\n` +
    `🎨 Estilo: ${settings.summaryStyle || 'bullet-points'}`;

  const menu = menuConfig();
  await sendWithButtons(msg, chatId, menu.buttons, token);
}

async function processRemover(chatId, user, token) {
  const interests = user?.interests?.filter(i => i.active) || [];

  if (!interests.length) {
    await sendTelegram('📌 Você não tem interesses para remover.', chatId, token);
    return;
  }

  const buttons = interests.map(i => ([{
    text: `❌ ${i.topic}`,
    callback_data: `remove_interest:${i.topic}`,
  }]));
  buttons.push([{ text: '« Voltar', callback_data: 'menu:config' }]);

  await sendWithButtons('Qual interesse deseja remover?', chatId, buttons, token);

  // Registra handler de remoção
  interactiveUsers.set(chatId, { step: 'removing', interests });
}

async function processAjuda(chatId, token) {
  const msg = `❓ Como usar o bot\n\n` +
    `Clique em /menu para abrir o painel com botões.\n\n` +
    `Ou envie mensagens diretas:\n` +
    `• "notícias de IA" → busca notícias\n` +
    `• "pesquisa profunda Rust" → briefing de vídeo\n` +
    `• "melhor framework JS" → comparação\n\n` +
    `Comandos disponíveis:\n` +
    `/menu · /noticias · /digest\n` +
    `/perfil · /adicionar · /remover\n` +
    `/horario · /estilo · /ajuda`;

  const menu = menuPrincipal();
  await sendWithButtons(msg, chatId, menu.buttons, token);
}

async function salvarHorario(chatId, user, cron, token) {
  const { createOrUpdateUser } = await import('../models/UserPreferences.js');
  await createOrUpdateUser({
    ...user,
    telegramChatId: chatId,
    digestSettings: { ...(user?.digestSettings || {}), cronSchedule: cron },
  });

  const [, hour] = cron.split(' ');
  const menu = menuConfig();
  await sendWithButtons(`✅ Horário definido para ${hour.padStart(2,'0')}:00`, chatId, menu.buttons, token);
}

async function salvarEstilo(chatId, user, estilo, token) {
  const { createOrUpdateUser } = await import('../models/UserPreferences.js');
  await createOrUpdateUser({
    ...user,
    telegramChatId: chatId,
    digestSettings: { ...(user?.digestSettings || {}), summaryStyle: estilo },
  });

  const nomes = { 'bullet-points': 'Bullet points', 'curto': 'Parágrafos curtos', 'detalhado': 'Parágrafos detalhados' };
  const menu = menuConfig();
  await sendWithButtons(`✅ Estilo alterado para: ${nomes[estilo] || estilo}`, chatId, menu.buttons, token);
}
