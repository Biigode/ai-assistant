// src/ai/llm.ts
// LLM via model-router — usa cloud (gpt-oss/qwen3.5) ou local automaticamente

import type {
  ChatResponseSettings,
  DigestGenerationSettings,
  SearchResult,
} from "../types/index.ts";
import { getActiveModel } from "./model-router.ts";

export async function checkOllama(): Promise<boolean> {
  try {
    const { ollama, model, mode } = await getActiveModel();
    const { models } = await ollama.list();
    console.log(`✅ Ollama OK — modelo: ${model} (${mode})`);
    console.log(
      `   Disponíveis: ${models.map((m) => m.name).join(", ") || "nenhum"}`,
    );
    return true;
  } catch {
    console.error("❌ Ollama não está rodando. Execute: ollama serve");
    return false;
  }
}

export async function classifyIntent(
  message: string,
): Promise<"search" | "chat"> {
  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Classifique a intenção do usuário em uma única palavra: "search" ou "chat".

Responda "search" se o usuário:
- Pede informações factuais, atuais ou recentes
- Pergunta sobre notícias, eventos, produtos, preços
- Quer saber sobre algo específico do mundo real
- Faz perguntas que precisam de dados atualizados
- Pede recomendações de produtos ou serviços

Responda "chat" se o usuário:
- Faz conversa casual ou cumprimentos
- Pede opinião subjetiva sem precisar de dados
- Faz perguntas sobre o próprio bot
- Pede para fazer algo (configurar, adicionar)

Mensagem: "${message}"

Resposta (apenas "search" ou "chat"):`,
      think: false,
      options: { temperature: 0.0, num_predict: 5 },
    });
    const word = res.response.trim().toLowerCase().split(/\s/)[0];
    return word === "search" ? "search" : "chat";
  } catch (err) {
    console.error("❌ classifyIntent:", (err as Error).message);
    return "chat";
  }
}

export async function extractSearchQuery(message: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Extraia uma query de busca curta (máximo 5 palavras) desta mensagem. Retorne APENAS a query.\n\nExemplos:\n"me fale as últimas notícias de IA que estão bombando" → "inteligência artificial notícias ${year}"\n"qual o melhor notebook para programador" → "melhor notebook programador ${year}"\n"tendências de programação esse ano" → "tendências programação ${year}"\n\nMensagem: "${message}"\n\nQuery:`,
      think: false,
      options: { temperature: 0.0, num_predict: 20 },
    });
    const query = res.response
      .trim()
      .replace(/^["'\n]+|["'\n]+$/g, "")
      .split("\n")[0];
    if (query.length < 3 || query.length > 80)
      throw new Error("query inválida");
    return query;
  } catch (err) {
    console.error("❌ extractSearchQuery:", (err as Error).message);
    const stopWords = new Set([
      "me",
      "fale",
      "as",
      "os",
      "um",
      "uma",
      "de",
      "da",
      "do",
      "que",
      "para",
      "com",
      "por",
      "em",
      "está",
      "estão",
      "sobre",
      "quais",
      "qual",
      "são",
      "este",
      "essa",
      "isso",
      "meu",
      "minha",
      "baseado",
      "interesse",
      "últimas",
      "novidades",
      "bombando",
      "conta",
    ]);
    const words = message
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w))
      .slice(0, 4);
    return (words.join(" ") || message.substring(0, 40)) + ` ${year}`;
  }
}

export async function extractInterests(input: string): Promise<string[]> {
  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Você é um assistente que analisa o perfil do usuário e gera tópicos de interesse para busca de notícias.

Analise o que o usuário disse sobre si mesmo e gere uma lista de tópicos relevantes.
Se ele mencionar uma profissão, área de atuação ou hobby, deduza os interesses relacionados.

Exemplos:
- "sou programador" → ["Programação", "Tecnologia", "Inteligência Artificial", "Desenvolvimento de Software"]
- "trabalho com marketing digital" → ["Marketing Digital", "Redes Sociais", "SEO", "E-commerce"]
- "gosto de investir em ações" → ["Mercado Financeiro", "Ações", "Economia", "Investimentos"]
- "IA, Cloud" → ["Inteligência Artificial", "Cloud Computing"]

Retorne APENAS um JSON array com 3 a 6 tópicos em português. Sem explicações.

Texto do usuário: "${input}"

Saída:`,
      think: false,
      options: { temperature: 0.3, num_predict: 200 },
    });
    const match = res.response.trim().match(/\[[\s\S]*\]/);
    if (!match) throw new Error("array não encontrado");
    const topics: unknown[] = JSON.parse(match[0]);
    if (!Array.isArray(topics) || !topics.length)
      throw new Error("array vazio");
    return topics.map((t) => String(t).trim()).filter(Boolean);
  } catch (err) {
    console.error("❌ extractInterests:", (err as Error).message);
    return input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
}

export async function generateChatResponse(
  userMessage: string,
  searchResults: SearchResult[] | null = null,
  settings: ChatResponseSettings = {},
): Promise<string> {
  const { name = "Usuário", context = "" } = settings;
  const today = new Date().toLocaleDateString("pt-BR");

  let searchCtx = "";
  if (searchResults?.length) {
    searchCtx =
      `\n\nResultados de busca (data: ${today}):\n` +
      searchResults
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`)
        .join("\n");
  }

  const historyCtx = context ? `\nConversa recente:\n${context}\n` : "";

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
    console.error("❌ generateChatResponse:", (err as Error).message);
    return "Desculpe, tive um problema técnico. Tente novamente em instantes.";
  }
}

export async function generateDigest(
  searchResults: Record<string, SearchResult[]>,
  settings: DigestGenerationSettings = {},
): Promise<string> {
  const { name = "Usuário", summaryStyle = "bullet-points" } = settings;
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let context = "";
  for (const [topic, articles] of Object.entries(searchResults)) {
    if (!articles.length) continue;
    context += `\n=== ${topic} ===\n`;
    articles.forEach((a, i) => {
      context += `${i + 1}. ${a.title}\n`;
      if (a.publishedAt) context += `   Publicado: ${a.publishedAt}\n`;
      context += `   ${a.snippet}\n`;
    });
  }

  if (!context.trim()) {
    return `📰 Digest — ${today}\n\nOlá ${name}! Não encontrei novidades hoje. Até amanhã! 👋`;
  }

  const styleHint: Record<string, string> = {
    curto: "Um parágrafo curto por tópico.",
    detalhado: "Parágrafo detalhado com 3-4 frases por tópico.",
    "bullet-points": "Use bullet points (•) por tópico.",
  };
  const hint = styleHint[summaryStyle] || styleHint["bullet-points"];

  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Monte um resumo das NOTÍCIAS DE HOJE (${today}) para ${name}.\nUse emojis, texto simples sem negrito. ${hint}\nDestaque o que é novidade DESTA SEMANA. Máximo 1400 caracteres. Termine com frase amigável.\n\nArtigos de hoje:\n${context}\n\nResumo:`,
      think: false,
      options: { temperature: 0.7, num_predict: 1500 },
    });
    return res.response.trim();
  } catch (err) {
    console.error("❌ generateDigest:", (err as Error).message);
    let fb = `📰 Digest — ${today}\n\nOlá ${name}! Aqui estão as novidades:\n\n`;
    for (const [topic, articles] of Object.entries(searchResults)) {
      if (!articles.length) continue;
      fb += `${topic}:\n`;
      articles.slice(0, 2).forEach((a) => {
        fb += `• ${a.title}\n`;
      });
      fb += "\n";
    }
    return fb.trim();
  }
}

export async function generateYouTubeScript(
  interests: string[],
  trendingResults: SearchResult[],
  creatorName: string = "Criador",
): Promise<string> {
  const today = new Date().toLocaleDateString("pt-BR");
  const topicsStr = interests.join(", ");

  let trendsCtx = "";
  if (trendingResults.length) {
    trendsCtx = "\n\nTendências atuais encontradas:\n" +
      trendingResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`).join("\n");
  }

  try {
    const { ollama, model } = await getActiveModel();
    const res = await ollama.generate({
      model,
      prompt: `Você é um especialista em criação de conteúdo para YouTube que gera roteiros otimizados para visualizações.

O criador se chama ${creatorName} e seus interesses/nicho são: ${topicsStr}.
Data de hoje: ${today}.
${trendsCtx}

Crie um roteiro completo para um vídeo do YouTube que:
1. Tenha um título chamativo e otimizado para cliques (com emoji)
2. Tenha uma thumbnail description (o que colocar na thumbnail)
3. Tenha um gancho forte nos primeiros 30 segundos que prenda a atenção
4. Desenvolva o conteúdo em seções claras (com timestamps sugeridos)
5. Tenha CTAs naturais (like, inscrever, comentar)
6. Termine com um cliffhanger para o próximo vídeo
7. Use tendências atuais quando possível para surfar no algoritmo

O tema deve intersectar os interesses do criador com algo que está trending ou que gere curiosidade.

Formato do roteiro:
🎬 TÍTULO: ...
🖼️ THUMBNAIL: ...
⏱️ DURAÇÃO SUGERIDA: ...

📝 ROTEIRO:

[00:00 - GANCHO]
...

[00:30 - INTRO]
...

[Seções do conteúdo com timestamps]
...

[ENCERRAMENTO + CTA]
...

🏷️ TAGS SUGERIDAS: ...
📝 DESCRIÇÃO DO VÍDEO: ...

Escreva em português brasileiro, tom informal e energético.`,
      think: false,
      options: { temperature: 0.8, num_predict: 3000 },
    });
    return `🎬 Roteiro para YouTube\n\n${res.response.trim()}`;
  } catch (err) {
    console.error("❌ generateYouTubeScript:", (err as Error).message);
    throw err;
  }
}
