// src/ai/llm.js
// LLM via model-router — usa cloud (gpt-oss/qwen3.5) ou local automaticamente

import { getActiveModel } from './model-router.js';

export async function checkOllama() {
  try {
    const { ollama, model, mode } = await getActiveModel();
    const { models } = await ollama.list();
    console.log(`✅ Ollama OK — modelo: ${model} (${mode})`);
    console.log(`   Disponíveis: ${models.map(m => m.name).join(', ') || 'nenhum'}`);
    return true;
  } catch {
    console.error('❌ Ollama não está rodando. Execute: ollama serve');
    return false;
  }
}

export async function classifyIntent(message) {
  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Classifique em uma palavra: "search", "chat" ou "digest".\n- search: pede informação atual, notícias, busca, produto\n- digest: pede resumo diário\n- chat: conversa geral\n\nMensagem: "${message}"\n\nResposta:`,
      think: false,
      options: { temperature: 0.0, num_predict: 5 },
    });
    const word = res.response.trim().toLowerCase().split(/\s/)[0];
    return ['search', 'digest'].includes(word) ? word : 'chat';
  } catch (err) {
    console.error('❌ classifyIntent:', err.message);
    return 'chat';
  }
}

export async function extractSearchQuery(message) {
  const year = new Date().getFullYear();
  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Extraia uma query de busca curta (máximo 5 palavras) desta mensagem. Retorne APENAS a query.\n\nExemplos:\n"me fale as últimas notícias de IA que estão bombando" → "inteligência artificial notícias ${year}"\n"qual o melhor notebook para programador" → "melhor notebook programador ${year}"\n"tendências de programação esse ano" → "tendências programação ${year}"\n\nMensagem: "${message}"\n\nQuery:`,
      think: false,
      options: { temperature: 0.0, num_predict: 20 },
    });
    const query = res.response.trim().replace(/^["'\n]+|["'\n]+$/g, '').split('\n')[0];
    if (query.length < 3 || query.length > 80) throw new Error('query inválida');
    return query;
  } catch (err) {
    console.error('❌ extractSearchQuery:', err.message);
    const stopWords = new Set(['me','fale','as','os','um','uma','de','da','do','que','para','com','por','em','está','estão','sobre','quais','qual','são','este','essa','isso','meu','minha','baseado','interesse','últimas','novidades','bombando','conta']);
    const words = message.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 4);
    return (words.join(' ') || message.substring(0, 40)) + ` ${year}`;
  }
}

export async function extractInterests(input) {
  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Liste os tópicos de interesse do texto como JSON array. Apenas o array.\n\nTexto: "${input}"\n\nExemplo: ["Inteligência Artificial","Mercado Financeiro"]\n\nSaída:`,
      think: false,
      options: { temperature: 0.1, num_predict: 150 },
    });
    const match = res.response.trim().match(/\[[\s\S]*\]/);
    if (!match) throw new Error('array não encontrado');
    const topics = JSON.parse(match[0]);
    if (!Array.isArray(topics) || !topics.length) throw new Error('array vazio');
    return topics.map(t => String(t).trim());
  } catch (err) {
    console.error('❌ extractInterests:', err.message);
    return input.split(',').map(t => t.trim()).filter(Boolean);
  }
}

export async function generateChatResponse(userMessage, searchResults = null, settings = {}) {
  const { name = 'Usuário', context = '' } = settings;
  const today = new Date().toLocaleDateString('pt-BR');

  let searchCtx = '';
  if (searchResults?.length) {
    searchCtx = `\n\nResultados de busca (data: ${today}):\n` +
      searchResults.map((r, i) => `${i+1}. ${r.title}\n   ${r.snippet}`).join('\n');
  }

  const historyCtx = context ? `\nConversa recente:\n${context}\n` : '';

  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Você é um assistente em português. Data de hoje: ${today}. Responda ${name} de forma clara e amigável (máximo 3 parágrafos).${historyCtx}${searchCtx}\n\n${name}: ${userMessage}\nAssistente:`,
      think: false,
      options: { temperature: 0.7, num_predict: 2000 },
    });
    return res.response.trim();
  } catch (err) {
    console.error('❌ generateChatResponse:', err.message);
    return 'Desculpe, tive um problema técnico. Tente novamente em instantes.';
  }
}

export async function generateDigest(searchResults, settings = {}) {
  const { name = 'Usuário', summaryStyle = 'bullet-points' } = settings;
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  let context = '';
  for (const [topic, articles] of Object.entries(searchResults)) {
    if (!articles.length) continue;
    context += `\n=== ${topic} ===\n`;
    articles.forEach((a, i) => {
      context += `${i+1}. ${a.title}\n`;
      if (a.publishedAt) context += `   Publicado: ${a.publishedAt}\n`;
      context += `   ${a.snippet}\n`;
    });
  }

  if (!context.trim()) {
    return `📰 Digest — ${today}\n\nOlá ${name}! Não encontrei novidades hoje. Até amanhã! 👋`;
  }

  const styleHint = {
    'curto':         'Um parágrafo curto por tópico.',
    'detalhado':     'Parágrafo detalhado com 3-4 frases por tópico.',
    'bullet-points': 'Use bullet points (•) por tópico.',
  }[summaryStyle] || 'Use bullet points (•) por tópico.';

  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Monte um resumo das NOTÍCIAS DE HOJE (${today}) para ${name}.\nUse emojis, texto simples sem negrito. ${styleHint}\nDestaque o que é novidade DESTA SEMANA. Máximo 1400 caracteres. Termine com frase amigável.\n\nArtigos de hoje:\n${context}\n\nResumo:`,
      think: false,
      options: { temperature: 0.7, num_predict: 1500 },
    });
    return res.response.trim();
  } catch (err) {
    console.error('❌ generateDigest:', err.message);
    let fb = `📰 Digest — ${today}\n\nOlá ${name}! Aqui estão as novidades:\n\n`;
    for (const [topic, articles] of Object.entries(searchResults)) {
      if (!articles.length) continue;
      fb += `${topic}:\n`;
      articles.slice(0, 2).forEach(a => { fb += `• ${a.title}\n`; });
      fb += '\n';
    }
    return fb.trim();
  }
}
