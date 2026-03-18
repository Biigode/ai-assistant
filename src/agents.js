// src/agents.js
// Pipeline de agentes para investigação profunda de notícias de TI
// Usa getReasoningModel() — prioriza gpt-oss:20b > qwen3.5 > local

import { getReasoningModel } from './model-router.js';
import { searchTopic, getCurrentDateContext } from './search.js';

// ─── Researcher Agent ─────────────────────────────────────────────────────────

export async function researcherAgent(topic) {
  console.log(`\n🔬 [Researcher] Investigando: "${topic}"`);

  const { year, month } = getCurrentDateContext();

  const queries = [
    `${topic} novidades ${month} ${year}`,
    `${topic} tendências engenharia software ${year}`,
    `${topic} impacto desenvolvedores ${year}`,
  ];

  const allResults = [];
  for (const q of queries) {
    const results = await searchTopic(q, 4);
    allResults.push(...results);
    await new Promise(r => setTimeout(r, 800));
  }

  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });

  console.log(`   📚 Fontes únicas encontradas: ${unique.length}`);
  return unique;
}

// ─── Analyst Agent ────────────────────────────────────────────────────────────

export async function analystAgent(sources, topic) {
  console.log(`\n🧠 [Analyst] Analisando ${sources.length} fontes sobre "${topic}"...`);

  const { ollama, model, mode } = await getReasoningModel();
  const { label } = getCurrentDateContext();

  const context = sources.map((s, i) =>
    `[${i + 1}] ${s.title}\nFonte: ${s.source}${s.publishedAt ? ` | Data: ${s.publishedAt}` : ''}\nResumo: ${s.snippet}\nLink: ${s.link}`
  ).join('\n\n');

  // gpt-oss e qwen3.5 suportam chain-of-thought — prompt mais rico
  const isAdvanced = mode === 'gpt-oss' || mode === 'qwen3.5';

  const prompt = isAdvanced
    ? `Você é um analista sênior de tecnologia. Data de hoje: ${label}.

Analise as ${sources.length} fontes RECENTES sobre "${topic}" e retorne JSON:
{
  "pontos_principais": ["ponto 1", "ponto 2", "ponto 3"],
  "impacto_devs": "parágrafo sobre impacto nos desenvolvedores",
  "alertas": ["dado não confirmado ou desatualizado"],
  "angulos_video": [
    {"titulo": "título do vídeo", "gancho": "frase de abertura", "pontos": ["p1", "p2", "p3"]},
    {"titulo": "título do vídeo", "gancho": "frase de abertura", "pontos": ["p1", "p2", "p3"]},
    {"titulo": "título do vídeo", "gancho": "frase de abertura", "pontos": ["p1", "p2", "p3"]}
  ],
  "fontes_usadas": [1, 2, 3]
}

Fontes:
${context}

JSON:`
    : `Data de hoje: ${label}. Analise as fontes sobre "${topic}" e retorne JSON:
{
  "pontos_principais": ["ponto 1", "ponto 2"],
  "impacto_devs": "resumo do impacto",
  "alertas": [],
  "angulos_video": [{"titulo": "título", "gancho": "gancho", "pontos": ["p1", "p2"]}],
  "fontes_usadas": [1, 2]
}

Fontes:
${context}

JSON:`;

  try {
    const res = await ollama.generate({
      model,
      prompt,
      think: false,
      options: {
        temperature: 0.3,
        num_predict: isAdvanced ? 3000 : 800,
        // gpt-oss suporta esforço de raciocínio configurável
        ...(mode === 'gpt-oss' ? { reasoning_effort: 'medium' } : {}),
      },
    });

    const match = res.response.trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON não encontrado');

    const analysis = JSON.parse(match[0]);
    console.log(`   ✅ Análise concluída via ${mode}`);
    return { analysis, sources, mode };
  } catch (err) {
    console.error(`   ❌ Analyst falhou:`, err.message);
    const { label: l, year: y } = getCurrentDateContext();
    return {
      analysis: {
        pontos_principais: sources.slice(0, 3).map(s => s.title),
        impacto_devs: `Novidades sobre ${topic} em ${l}.`,
        alertas: [],
        angulos_video: [{
          titulo: `Tudo sobre ${topic} em ${y}`,
          gancho: `O que está acontecendo com ${topic} agora!`,
          pontos: sources.slice(0, 3).map(s => s.title),
        }],
        fontes_usadas: [1, 2, 3],
      },
      sources,
      mode: 'fallback',
    };
  }
}

// ─── Writer Agent ─────────────────────────────────────────────────────────────

export async function writerAgent(analystResult, topic) {
  console.log(`\n✍️  [Writer] Gerando briefing para "${topic}"...`);

  const { analysis, sources, mode: analystMode } = analystResult;
  const { ollama, model, mode } = await getReasoningModel();
  const { label, year } = getCurrentDateContext();

  const prompt = `Você é um roteirista de YouTube especializado em tecnologia e engenharia de software.
Data de hoje: ${label}. Modelo usado na análise: ${analystMode}.

Com base na análise abaixo sobre "${topic}", crie um briefing completo para um vídeo sobre ACONTECIMENTOS RECENTES.

Análise:
${JSON.stringify(analysis, null, 2)}

Formato em português brasileiro:

=== BRIEFING: ${topic.toUpperCase()} — ${label.toUpperCase()} ===

📌 ÂNGULO RECOMENDADO
[melhor ângulo para maximizar views sobre o que aconteceu AGORA]

🎬 TÍTULO SUGERIDO
[título principal com gancho temporal]

🪝 GANCHO DE ABERTURA (primeiros 30 segundos)
[texto referenciando o que é notícia HOJE]

📋 ROTEIRO RESUMIDO
1. [ponto 1]
2. [ponto 2]
3. [ponto 3]
4. [ponto 4]
5. [conclusão / call to action]

💡 POR QUE ISSO É IMPORTANTE AGORA
[contexto temporal — por que fazer o vídeo hoje]

#️⃣ HASHTAGS SUGERIDAS
[5-8 hashtags relevantes para ${year}]

📚 FONTES VERIFICADAS
[lista com links]`;

  try {
    const res = await ollama.generate({
      model,
      prompt,
      think: false,
      options: {
        temperature: 0.7,
        num_predict: 3000,
        ...(mode === 'gpt-oss' ? { reasoning_effort: 'low' } : {}),
      },
    });

    console.log(`   ✅ Briefing gerado via ${mode}`);
    return {
      topic,
      briefing:    res.response.trim(),
      analysis,
      sources:     sources.slice(0, 5),
      generatedAt: new Date(),
      model:       mode,
    };
  } catch (err) {
    console.error(`   ❌ Writer falhou:`, err.message);
    const fontes = sources.slice(0, 5).map((s, i) => `${i+1}. ${s.title} — ${s.link}`).join('\n');
    return {
      topic,
      briefing: `=== BRIEFING: ${topic.toUpperCase()} — ${label} ===\n\n` +
        `📌 PONTOS PRINCIPAIS\n${analysis.pontos_principais.map(p => `• ${p}`).join('\n')}\n\n` +
        `💡 IMPACTO\n${analysis.impacto_devs}\n\n` +
        `📚 FONTES\n${fontes}`,
      analysis,
      sources:     sources.slice(0, 5),
      generatedAt: new Date(),
      model:       'fallback',
    };
  }
}

// ─── Pipeline completo ────────────────────────────────────────────────────────

export async function runResearchPipeline(topic) {
  const { label } = getCurrentDateContext();
  console.log(`\n🚀 Iniciando pipeline para: "${topic}" [${label}]`);
  console.log('='.repeat(60));

  try {
    const sources       = await researcherAgent(topic);
    const analystResult = await analystAgent(sources, topic);
    const briefing      = await writerAgent(analystResult, topic);

    try {
      const { getDB } = await import('./db.js');
      const db = getDB();
      await db.collection('briefings').insertOne(briefing);
      console.log(`\n💾 Briefing salvo no MongoDB`);
    } catch (dbErr) {
      console.warn('⚠️  Não foi possível salvar no MongoDB:', dbErr.message);
    }

    console.log(`\n✅ Pipeline concluído para "${topic}" via ${briefing.model}`);
    return briefing;
  } catch (err) {
    console.error(`\n❌ Pipeline falhou:`, err.message);
    throw err;
  }
}

