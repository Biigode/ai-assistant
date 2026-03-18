// src/search.js
// Busca em cadeia de prioridade:
// 1. Ollama Web Search (primário — usa OLLAMA_API_KEY)
// 2. DDG Instant Answer API (fallback — oficial, sem key)

import fetch from 'node-fetch';

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const MAX_SNIPPET    = 300;

function getCurrentDateContext() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.toLocaleString('pt-BR', { month: 'long' });
  const day   = now.getDate();
  return { year, month, day, label: `${day} de ${month} de ${year}` };
}

function buildQuery(topic) {
  const { year } = getCurrentDateContext();
  const semAno = topic.replace(/\b20\d{2}\b/g, '').trim();
  return `${semAno} ${year}`;
}

function truncate(str, max) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim().substring(0, max);
}

function toHostname(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return 'desconhecido'; }
}

function logSearch(topic, results, source) {
  const { label } = getCurrentDateContext();
  console.log(`\n📋 [${label}] "${topic}" → ${results.length} resultado(s) via ${source}`);
  results.forEach((r, i) => console.log(`   ${i + 1}. ${r.title} [${r.source}]`));
  console.log('='.repeat(60));
}

// ─── Estratégia 1: Ollama Web Search ─────────────────────────────────────────

async function searchOllama(query, num) {
  if (!OLLAMA_API_KEY) throw new Error('OLLAMA_API_KEY não configurada');

  const res = await fetch('https://ollama.com/api/web_search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OLLAMA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.results?.length) throw new Error('sem resultados');

  return data.results.slice(0, num).map(item => ({
    title:       truncate(item.title || 'Sem título', 150),
    link:        item.url || '',
    snippet:     truncate(item.content || item.snippet || '', MAX_SNIPPET),
    source:      toHostname(item.url || ''),
    publishedAt: null,
  })).filter(r => r.link.startsWith('http'));
}

// ─── Estratégia 2: DDG Instant Answer (fallback sem key) ─────────────────────

async function searchDDGInstant(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'daily-digest-bot/2.0' } });
  if (!res.ok) throw new Error(`DDG HTTP ${res.status}`);

  const data = await res.json();
  const results = [];

  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title:       data.Heading || query,
      link:        data.AbstractURL,
      snippet:     truncate(data.AbstractText, MAX_SNIPPET),
      source:      data.AbstractSource || toHostname(data.AbstractURL),
      publishedAt: null,
    });
  }

  for (const topic of data.RelatedTopics || []) {
    if (!topic.FirstURL || !topic.Text) continue;
    results.push({
      title:       truncate(topic.Text, 100),
      link:        topic.FirstURL,
      snippet:     truncate(topic.Text, MAX_SNIPPET),
      source:      toHostname(topic.FirstURL),
      publishedAt: null,
    });
    if (results.length >= 5) break;
  }

  if (!results.length) throw new Error('DDG sem conteúdo para esta query');
  return results;
}

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

export async function searchTopic(topic, num = 5) {
  const query = buildQuery(topic);
  const { label } = getCurrentDateContext();
  console.log(`\n🔍 Buscando [${label}]: "${query}"`);

  const strategies = [
    { name: 'Ollama Search', fn: () => searchOllama(query, num)  },
    { name: 'DDG Instant',   fn: () => searchDDGInstant(query)   },
  ];

  for (const s of strategies) {
    try {
      const results = await s.fn();
      if (results.length > 0) {
        logSearch(topic, results, s.name);
        return results;
      }
    } catch (err) {
      console.warn(`   ↩ ${s.name} falhou: ${err.message}`);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.error(`   ❌ Nenhuma estratégia retornou resultados para "${topic}"`);
  return [];
}

export async function searchAllTopics(topics, perTopic = 3) {
  console.log(`\n🔍 Buscando ${topics.length} tópico(s)...`);
  const results = {};
  for (const topic of topics) {
    results[topic] = await searchTopic(topic, perTopic);
    await new Promise(r => setTimeout(r, 1000));
  }
  return results;
}

export { getCurrentDateContext };
