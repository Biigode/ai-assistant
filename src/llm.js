// src/llm.js
// LLM local via Ollama para duas funções:
//   1. Extrair interesses de linguagem natural
//   2. Montar o resumo diário formatado para WhatsApp

import { Ollama } from 'ollama';

const ollama = new Ollama({ host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434' });
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

/**
 * Verifica se o Ollama está rodando e o modelo disponível
 */
export async function checkOllama() {
  try {
    const models = await ollama.list();
    const available = models.models.map(m => m.name);
    const found = available.some(m => m.startsWith(MODEL.split(':')[0]));

    if (!found) {
      console.warn(`⚠️  Modelo "${MODEL}" não encontrado.`);
      console.warn(`   Execute: ollama pull ${MODEL}`);
      console.warn(`   Modelos disponíveis: ${available.join(', ') || 'nenhum'}`);
      return false;
    }

    console.log(`✅ Ollama OK — modelo: ${MODEL}`);
    return true;
  } catch {
    console.error('❌ Ollama não está rodando. Execute: ollama serve');
    return false;
  }
}

/**
 * Extrai tópicos de interesse a partir de texto livre do usuário
 * Ex: "gosto de IA, carros elétricos e futebol brasileiro"
 * Retorna: ["Inteligência Artificial", "Carros Elétricos", "Futebol Brasileiro"]
 */
export async function extractInterests(userInput) {
  const prompt = `Você é um assistente que extrai tópicos de interesse de um texto.
Analise o texto abaixo e retorne APENAS um array JSON com os tópicos identificados.
Os tópicos devem ser curtos (2-4 palavras), em português, e prontos para usar como query de busca.
Não inclua explicações, apenas o JSON.

Texto: "${userInput}"

Exemplo de saída: ["Inteligência Artificial", "Mercado Financeiro", "Futebol Brasileiro"]

Saída:`;

  try {
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.1, num_predict: 200 },
    });

    const raw = response.response.trim();

    // Tenta extrair o JSON mesmo que o modelo adicione texto extra
    const match = raw.match(/\[.*\]/s);
    if (!match) throw new Error('JSON não encontrado na resposta');

    const topics = JSON.parse(match[0]);

    if (!Array.isArray(topics) || topics.length === 0) {
      throw new Error('Array vazio ou inválido');
    }

    return topics.map(t => String(t).trim());
  } catch (err) {
    console.error('❌ Erro ao extrair interesses com LLM:', err.message);
    // Fallback: divide por vírgula
    return userInput.split(',').map(t => t.trim()).filter(Boolean);
  }
}

/**
 * Gera o resumo diário formatado para WhatsApp
 * @param {Object} searchResults - { topic: [{title, snippet, link}] }
 * @param {Object} settings - { name, language, summaryStyle }
 */
export async function generateDigest(searchResults, settings = {}) {
  const { name = 'Usuário', summaryStyle = 'bullet-points' } = settings;

  // Monta o contexto com os artigos encontrados
  let context = '';
  for (const [topic, articles] of Object.entries(searchResults)) {
    if (!articles.length) continue;
    context += `\n### ${topic}\n`;
    articles.forEach((a, i) => {
      context += `${i + 1}. ${a.title}\n   ${a.snippet}\n   Fonte: ${a.source}\n`;
    });
  }

  if (!context.trim()) {
    return `📰 *Seu Digest Diário*\n\nOlá ${name}! Não encontrei novidades para hoje nos seus tópicos de interesse. Até amanhã! 👋`;
  }

  const styleInstructions = {
    'curto': 'Escreva um parágrafo curto por tópico (máximo 2 frases).',
    'detalhado': 'Escreva um parágrafo detalhado por tópico com 3-4 frases.',
    'bullet-points': 'Use bullet points (•) para cada ponto importante por tópico.',
  };

  const prompt = `Você é um assistente de curadoria de notícias. 
Monte uma mensagem de resumo diário para WhatsApp para o usuário chamado ${name}.

Regras de formatação:
- Use emojis relevantes para deixar a mensagem mais amigável
- Comece com "📰 *Digest Diário - [data de hoje]*"
- Use *negrito* para nomes de tópicos (usando asteriscos do WhatsApp)
- ${styleInstructions[summaryStyle] || styleInstructions['bullet-points']}
- Termine com uma frase de encerramento amigável
- Máximo de 1500 caracteres no total
- Escreva em português do Brasil

Artigos encontrados:
${context}

Mensagem formatada para WhatsApp:`;

  try {
    console.log('🤖 Gerando resumo com LLM local...');
    const response = await ollama.generate({
      model: MODEL,
      prompt,
      options: { temperature: 0.7, num_predict: 600 },
    });

    return response.response.trim();
  } catch (err) {
    console.error('❌ Erro ao gerar digest com LLM:', err.message);

    // Fallback: monta mensagem simples sem LLM
    let fallback = `📰 *Digest Diário*\n\nOlá ${name}! Aqui estão as novidades:\n\n`;
    for (const [topic, articles] of Object.entries(searchResults)) {
      if (!articles.length) continue;
      fallback += `*${topic}*\n`;
      articles.slice(0, 2).forEach(a => {
        fallback += `• ${a.title}\n`;
      });
      fallback += '\n';
    }
    return fallback.trim();
  }
}
