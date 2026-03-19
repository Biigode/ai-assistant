// src/ai/analysis.js
// Análise de resultados de busca via LLM — usa model-router

import { getActiveModel } from './model-router.js';

function buildContext(results) {
  if (Array.isArray(results)) {
    return results.map((a, i) =>
      `${i + 1}. ${a.title}\n   ${a.snippet || ''}\n   Fonte: ${a.source}\n   Link: ${a.link}`
    ).join('\n\n');
  }
  let context = '';
  for (const [topic, articles] of Object.entries(results)) {
    if (!articles.length) continue;
    context += `\n=== ${topic} ===\n`;
    articles.forEach((a, i) => {
      context += `${i + 1}. ${a.title}\n   ${a.snippet || ''}\n   Fonte: ${a.source}\n   Link: ${a.link}\n\n`;
    });
  }
  return context;
}

async function analyze(prompt, numPredict = 1000) {
  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model, prompt, think: false,
      options: { temperature: 0.7, num_predict: numPredict },
    });
    return res.response.trim() || null;
  } catch (err) {
    console.error('❌ Erro na análise:', err.message);
    return null;
  }
}

export async function analyzeProduct(results, userQuery) {
  return analyze(
    `Você é um assistente de comparações de produtos.\n\nO usuário quer: "${userQuery}"\n\nUse os resultados abaixo para analisar e retornar:\n1. Melhores opções encontradas\n2. Pontos positivos de cada uma\n3. Pontos negativos\n4. Recomendação final\n\nResultados:\n${buildContext(results)}\n\nResposta em português, texto puro:`,
    1000
  );
}

export async function analyzeContent(results, userQuery) {
  return analyze(
    `Você é um assistente de conteúdo para YouTubers de tecnologia.\n\nO usuário perguntou: "${userQuery}"\n\nUse os resultados abaixo para retornar:\n1. Resumo das notícias em 2-3 parágrafos\n2. Ideias de vídeo (3-5 sugestões com títulos)\n3. Hashtags sugeridas\n\nResultados:\n${buildContext(results)}\n\nResposta em português, texto puro:`,
    1200
  );
}

export async function analyzeNews(results, userQuery) {
  return analyze(
    `Você é um assistente de curadoria de notícias.\nO usuário quer saber sobre: "${userQuery}"\n\nUse os resultados abaixo para retornar:\n1. Resumo em 2-3 parágrafos\n2. Pontos-chave (lista)\n3. O que é importante acompanhar\n\nResultados:\n${buildContext(results)}\n\nResposta em português, texto puro:`,
    1000
  );
}

export async function analyzeGeneral(results, userQuery) {
  return analyze(
    `Você é um assistente útil.\n\nO usuário perguntou: "${userQuery}"\n\nUse os resultados abaixo para responder de forma clara e direta.\n\nResultados:\n${buildContext(results)}\n\nResposta em português, texto puro:`,
    800
  );
}
