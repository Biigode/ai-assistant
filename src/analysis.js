// src/analysis.js
// Análise inteligente de resultados de busca usando LLM

import { Ollama } from 'ollama';

const ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434' });
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

function buildContext(results) {
  let context = '';
  for (const [topic, articles] of Object.entries(results)) {
    if (!articles.length) continue;
    context += `\n=== ${topic} ===\n`;
    articles.forEach((a, i) => {
      context += `${i + 1}. ${a.title}\n`;
      context += `   ${a.snippet || ''}\n`;
      context += `   Fonte: ${a.source}\n`;
      context += `   Link: ${a.link}\n\n`;
    });
  }
  return context;
}

export async function analyzeProduct(results, userQuery) {
  const context = buildContext(results);

  const prompt = `Você é um assistente de comparações de produtos.

O usuário quer: "${userQuery}"

IMPORTANTE: Você TEM acesso aos resultados da busca abaixo. Use esses resultados para fazer a análise.

Analise e retorne:
1. Melhores opções encontradas (liste)
2. Pontos positivos de cada uma
3. Pontos negativos ou atenção
4. Recomendação final

Resultados da busca:
${context}

Resposta em português brasileiro, texto puro:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 1000 }
    });
    return response.response.trim();
  } catch (err) {
    console.error('❌ Erro ao analisar produto:', err.message);
    return null;
  }
}

export async function analyzeContent(results, userQuery) {
  const context = buildContext(results);

  const prompt = `Você é um assistente de conteúdo para criadores do YouTube.

O usuário (YouTuber) perguntou: "${userQuery}"

IMPORTANTE: Você TEM acesso aos resultados da busca abaixo. Use esses resultados para sugerir ideias.

Analise e retorne:
1. Resumo das notícias em 2-3 parágrafos
2. Ideias de vídeo (3-5 sugestões com títulos)
3. Hashtags sugeridas

Resultados da busca:
${context}

Resposta em português brasileiro, texto puro:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 1200 }
    });
    return response.response.trim();
  } catch (err) {
    console.error('❌ Erro ao analisar conteúdo:', err.message);
    return null;
  }
}

export async function analyzeNews(results, userQuery) {
  const context = buildContext(results);

  const prompt = `Você é um assistente de curadoria de notícias.
O usuário quer saber sobre: "${userQuery}"

IMPORTANTE: Você TEM acesso aos resultados da busca abaixo. NÃO diga que não tem acesso a informações em tempo real. Use os resultados fornecidos para fazer o resumo.

Analise os resultados e retorne:
1. Resumo das notícias em 2-3 parágrafos
2. Pontos-chave (lista)
3. O que é importante acompanhar

Resultados da busca:
${context}

Resposta em português brasileiro, texto puro:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 1000 }
    });
    return response.response.trim();
  } catch (err) {
    console.error('❌ Erro ao analisar notícias:', err.message);
    return null;
  }
}

export async function analyzeGeneral(results, userQuery) {
  const context = buildContext(results);

  const prompt = `Você é um assistente útil.

O usuário perguntou: "${userQuery}"

IMPORTANTE: Você TEM acesso aos resultados da busca abaixo. NÃO diga que não tem acesso a informações em tempo real, não peça para o usuário buscar em outros sites. Use os resultados fornecidos abaixo para responder.

Instruções:
- Resuma as notícias principais encontradas
- Destaque os pontos mais importantes
- Seja útil e direto

Resultados da busca:
${context}

Resposta em português brasileiro, texto puro:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 800 }
    });
    return response.response.trim();
  } catch (err) {
    console.error('❌ Erro ao analisar:', err.message);
    return null;
  }
}
