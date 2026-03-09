// src/search.js
// Busca usando Ollama Web Search API via curl/fetch

import fetch from 'node-fetch';

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const MAX_SNIPPET_LENGTH = 200;

function logSearch(topic, results) {
  const timestamp = new Date().toLocaleString('pt-BR');
  console.log(`\n📋 [${timestamp}] BUSCA: "${topic}"`);
  console.log(`   Encontrados: ${results.length} resultado(s)`);
  
  results.forEach((r, i) => {
    console.log(`\n   🔗 Resultado ${i + 1}:`);
    console.log(`      Título: ${r.title}`);
    console.log(`      Link:   ${r.link}`);
    console.log(`      Fonte: ${r.source}`);
  });
  
  console.log('\n' + '='.repeat(60));
}

function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export async function searchTopic(topic, num = 3) {
  return await searchWithOllama(topic, num);
}

async function searchWithOllama(topic, num) {
  if (!OLLAMA_API_KEY) {
    console.error('⚠️  OLLAMA_API_KEY não configurada no .env');
    return [];
  }

  try {
    console.log(`\n🔍 Buscando via Ollama Web Search: "${topic}"`);

    const response = await fetch('https://ollama.com/api/web_search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${topic} notícias Brasil`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.warn(`⚠️  Nenhum resultado do Ollama Web Search para: "${topic}"`);
      return [];
    }

    const articles = data.results.slice(0, num).map(item => {
      const rawContent = item.content || '';
      return {
        title: truncate(item.title || 'Sem título', 150),
        link: item.url || '',
        snippet: truncate(rawContent, MAX_SNIPPET_LENGTH),
        source: item.url ? new URL(item.url).hostname : 'Unknown',
      };
    }).filter(a => a.title && a.link && a.link.startsWith('http'));

    logSearch(topic, articles);
    
    return articles;

  } catch (err) {
    console.error(`❌ Erro ao buscar "${topic}":`, err.message);
    return [];
  }
}

export async function searchAllTopics(topics, perTopic = 3) {
  console.log(`\n🔍 Buscando ${topics.length} tópico(s) via Ollama Web Search...`);
  const results = {};

  for (const topic of topics) {
    console.log(`   → ${topic}`);
    results[topic] = await searchTopic(topic, perTopic);
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}
