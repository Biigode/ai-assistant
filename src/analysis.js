// src/analysis.js
// Análise inteligente de resultados de busca usando LLM

import { Ollama } from 'ollama';

const ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434' });
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

function buildContext(results) {
  let context = '';
  for (const [topic, articles] of Object.entries(results)) {
    if (!articles.length) continue;
    context += `\n## ${topic}\n`;
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

Analise os resultados abaixo e retorne um resumo com:
1. **Melhores opções** - liste 2-3 produtos com base nos resultados
2. **Pontos positivos** de cada um
3. **Pontos negativos** ou pontos de atenção
4. **Recomendação final** - qual vale mais a pena e por quê
5. **Veredicto final** em uma linha

Os resultados são da web, podem não ser exatamente produtos. Analise o que encontrou.

Resultados:
${context}

Resposta em português brasileiro, use Markdown:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 800 }
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
O usuário é um YouTuber e perguntou: "${userQuery}"

Analise os resultados e retorne:
1. **Resumo das notícias** - síntese dos principais pontos (2-3 parágrafos)
2. **Ideias de vídeo** - 3-5 sugestões de vídeos baseadas nas notícias
   - Para cada ideia: título sugerido e por que é relevante
3. **Ângulos de conteúdo** - formas diferentes de abordar o tema
4. **Hashtags sugeridas**

Resultados:
${context}

Resposta em português brasileiro, use Markdown:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 1000 }
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

Analise os resultados e retorne:
1. **Resumo** - síntese das principais notícias (3-4 parágrafos)
2. **Pontos-chave** - bullet points dos fatos mais importantes
3. **Contexto** -背景 relevante para entender a situação
4. **O que acompanhar** - próximos passos ou desenvolvimentos esperados

Resultados:
${context}

Resposta em português brasileiro, use Markdown:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 800 }
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

Com base nos resultados da web abaixo, responda de forma clara e útil.
Se os resultados forem sobre produtos, compare-os.
Se forem notícias, resuma os pontos principais.
Se forem informações gerais, sintetize da melhor forma.

Resultados:
${context}

Resposta em português brasileiro, use Markdown:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 600 }
    });
    return response.response.trim();
  } catch (err) {
    console.error('❌ Erro ao analisar:', err.message);
    return null;
  }
}
