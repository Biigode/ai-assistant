// src/queue-workers/message-handler.ts
// Processa mensagens e callbacks do Telegram via filas

import { runResearchPipeline } from "../ai/agents.ts";
import { extractInterests, generateYouTubeScript } from "../ai/llm.ts";
import { handleChatMessage, handleNewsDetail } from "../chat.ts";
import { connectDB } from "../core/db.ts";
import { connectQueue, consume, publish, QUEUES } from "../core/queue.ts";
import { searchTopic } from "../features/core/search.ts";
import { runDigestForAll } from "../features/news/summary.ts";
import { createOrUpdateUser, findUserByChatId } from "../models/UserPreferences.ts";
import { answerCallbackQuery } from "../telegram/telegram-api.ts";
import { menuConfig, menuEstilo, menuHorario, menuNoticias, menuPrincipal } from "../telegram/telegram-menus.ts";
import type { TelegramIncoming, TelegramIncomingCallback, TelegramIncomingMessage } from "../types/queue.ts";
import type { InlineButton } from "../types/telegram.ts";

interface InteractiveState {
  step: string;
}

const interactiveUsers = new Map<string, InteractiveState>();
const processedCallbacks = new Set<string>();

async function sendMessage(chatId: string, text: string, buttons: InlineButton[][] | null, token: string): Promise<void> {
  await publish(QUEUES.TELEGRAM_OUTGOING, { type: "inlineKeyboard", chatId, text, buttons, token });
}

async function sendSimple(chatId: string, text: string, token: string): Promise<void> {
  await publish(QUEUES.TELEGRAM_OUTGOING, { type: "message", chatId, text, token });
}

async function handleMessage({ chatId, text, name, token }: TelegramIncomingMessage): Promise<void> {
  if (interactiveUsers.has(chatId)) {
    return handleInteractive(chatId, text, name, token);
  }

  if (text.startsWith("/")) {
    return handleCommand(chatId, text.split(" ")[0].toLowerCase(), name, token);
  }

  await sendSimple(chatId, "🤖 Pensando...", token);
  const response = await handleChatMessage(chatId, text, name);
  if (response) await sendMessage(chatId, response, null, token);
}

async function handleCallback({ chatId, msgId, queryId, data, name, token }: TelegramIncomingCallback): Promise<void> {
  if (processedCallbacks.has(queryId)) return;
  processedCallbacks.add(queryId);
  setTimeout(() => processedCallbacks.delete(queryId), 5000);

  const handlers: Record<string, () => Promise<void> | void> = {
    "menu:principal": () => answerCallbackQuery(queryId, "", token).then(() => showMenu(chatId, msgId, "principal", token)),
    "menu:config": () => answerCallbackQuery(queryId, "", token).then(() => showMenu(chatId, msgId, "config", token)),
    "menu:horario": () => answerCallbackQuery(queryId, "", token).then(() => showMenu(chatId, msgId, "horario", token)),
    "menu:estilo": () => answerCallbackQuery(queryId, "", token).then(() => showMenu(chatId, msgId, "estilo", token)),
    "cmd:noticias": () => answerCallbackQuery(queryId, "📰 Buscando...", token).then(() => processNoticias(chatId, token)),
    "cmd:perfil": () => answerCallbackQuery(queryId, "", token).then(() => processPerfil(chatId, token)),
    "cmd:roteiro": () => answerCallbackQuery(queryId, "🎬 Gerando roteiro...", token).then(() => processRoteiro(chatId, name, token)),
    "cmd:adicionar": () => answerCallbackQuery(queryId, "", token).then(() => {
      sendSimple(chatId, '📝 Me conte sobre você!\n\nExemplo: "Sou programador e gosto de IA" ou "Trabalho com marketing digital".\n\nA IA vai entender seus interesses automaticamente.', token);
      interactiveUsers.set(chatId, { step: "add_interest" });
    }),
    "cmd:remover": () => answerCallbackQuery(queryId, "", token).then(() => processRemover(chatId, token)),
  };

  const prefixHandlers: Record<string, (value: string) => void> = {
    "horario:": (value: string) => {
      answerCallbackQuery(queryId, "✅", token);
      saveSettings(chatId, { cronSchedule: value }, token);
    },
    "estilo:": (value: string) => {
      answerCallbackQuery(queryId, "✅", token);
      saveSettings(chatId, { summaryStyle: value }, token);
    },
    "research:": (value: string) => {
      answerCallbackQuery(queryId, "🔬 Investigando...", token);
      processResearch(chatId, value, token);
    },
    "noticia:": (value: string) => {
      answerCallbackQuery(queryId, "📰 Carregando...", token);
      handleNewsDetail(chatId, (parseInt(value) + 1).toString()).then((detail) => {
        if (detail) sendSimple(chatId, detail, token);
      });
    },
    "remove_interest:": (value: string) => {
      answerCallbackQuery(queryId, "", token);
      removeInterest(chatId, value, token);
    },
  };

  for (const [prefix, handler] of Object.entries(prefixHandlers)) {
    if (data.startsWith(prefix)) {
      return handler(data.replace(prefix, ""));
    }
  }

  const handler = handlers[data];
  if (handler) return handler() as Promise<void>;
  answerCallbackQuery(queryId, "⚠️", token);
}

type MenuType = "principal" | "config" | "horario" | "estilo";

async function handleCommand(chatId: string, cmd: string, name: string, token: string): Promise<void> {
  const menuCommands: Record<string, () => Promise<void> | void> = {
    "/start": () => showMenu(chatId, null, "principal", token, name),
    "/menu": () => showMenu(chatId, null, "principal", token, name),
    "/noticias": () => processNoticias(chatId, token),
    "/perfil": () => processPerfil(chatId, token),
    "/roteiro": () => processRoteiro(chatId, name, token),
    "/resumo": () => processResumo(chatId, name, token),
    "/adicionar": () => {
      sendSimple(chatId, '📝 Me conte sobre você!\n\nExemplo: "Sou programador e gosto de IA".\n\nA IA vai entender seus interesses automaticamente.', token);
      interactiveUsers.set(chatId, { step: "add_interest" });
    },
    "/remover": () => processRemover(chatId, token),
    "/config": () => showMenu(chatId, null, "config", token),
  };

  const handler = menuCommands[cmd];
  if (handler) return handler() as Promise<void>;
  sendMessage(chatId, "❓ Use /menu para ver as opções.", menuPrincipal().buttons, token);
}

async function handleInteractive(chatId: string, text: string, name: string, token: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  const step = interactiveUsers.get(chatId);
  if (!step) return;

  if (step.step === "add_interest") {
    await sendSimple(chatId, "🧠 Analisando seus interesses...", token);
    let topics: string[];
    try {
      topics = await extractInterests(text);
    } catch {
      topics = text.split(",").map((t) => t.trim()).filter(Boolean);
    }
    const interests = [...(user?.interests || [])];
    let added = 0;
    for (const t of topics) {
      if (!interests.find((i) => i.topic.toLowerCase() === t.toLowerCase())) {
        interests.push({ topic: t, keywords: [], active: true, addedAt: new Date() });
        added++;
      }
    }
    await createOrUpdateUser({ ...user, telegramChatId: chatId, interests });
    const msg = added > 0
      ? `✅ Entendi! Adicionei ${added} interesse(s):\n\n${topics.map(t => `• ${t}`).join("\n")}\n\nAgora você pode ver notícias personalizadas!`
      : `ℹ️ Esses interesses já estavam cadastrados: ${topics.join(", ")}`;
    sendMessage(chatId, msg, menuPrincipal().buttons, token);
    interactiveUsers.delete(chatId);
  }
}

async function showMenu(chatId: string, msgId: number | null, type: MenuType, token: string, name: string = ""): Promise<void> {
  const menus: Record<MenuType, { text: string; buttons: InlineButton[][] }> = {
    principal: menuPrincipal(name),
    config: menuConfig(),
    horario: menuHorario(),
    estilo: menuEstilo(),
  };

  const { text, buttons } = menus[type] || menus.principal;
  if (msgId) {
    await publish(QUEUES.TELEGRAM_OUTGOING, { type: "editMessage", chatId, msgId, text, buttons, token });
  } else {
    await sendMessage(chatId, text, buttons, token);
  }
}

async function processNoticias(chatId: string, token: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  const interests = user?.interests?.filter((i) => i.active).map((i) => i.topic) || [];

  if (!interests.length) {
    return sendMessage(chatId, "⚠️ Configure interesses primeiro!", menuPrincipal().buttons, token);
  }

  await sendSimple(chatId, "📰 Buscando...", token);
  const results = await searchTopic(interests.slice(0, 3).join(", "), 5);
  if (!results.length) return sendSimple(chatId, "😕 Sem notícias agora.", token);

  const { text, buttons } = menuNoticias(results, "");
  await sendMessage(chatId, text, buttons, token);
}

async function processResumo(chatId: string, name: string, token: string): Promise<void> {
  await sendSimple(chatId, `📦 Gerando resumo, ${name}...`, token);
  await runDigestForAll(chatId);
  await sendMessage(chatId, "✅ Resumo enviado!", menuPrincipal(name).buttons, token);
}

async function processResearch(chatId: string, tema: string, token: string): Promise<void> {
  await publish(QUEUES.TELEGRAM_OUTGOING, { type: "longMessage", chatId, text: `🔬 Investigando "${tema}"...`, token });
  try {
    const result = await runResearchPipeline(tema);
    await publish(QUEUES.TELEGRAM_OUTGOING, { type: "longMessage", chatId, text: result.briefing, token });
  } catch (err) {
    await sendSimple(chatId, `❌ Erro: ${(err as Error).message}`, token);
  }
  await sendMessage(chatId, "O que mais?", menuPrincipal().buttons, token);
}

async function processRoteiro(chatId: string, name: string, token: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  const interests = user?.interests?.filter((i) => i.active).map((i) => i.topic) || [];

  if (!interests.length) {
    return sendMessage(chatId, "⚠️ Adicione seus interesses primeiro para gerar roteiros!", menuPrincipal().buttons, token);
  }

  await sendSimple(chatId, "🎬 Gerando roteiro baseado nos seus interesses...", token);

  try {
    const results = await searchTopic(interests.slice(0, 3).join(", "), 5);
    const script = await generateYouTubeScript(interests, results, name);
    await publish(QUEUES.TELEGRAM_OUTGOING, { type: "longMessage", chatId, text: script, token });
  } catch (err) {
    await sendSimple(chatId, `❌ Erro ao gerar roteiro: ${(err as Error).message}`, token);
  }
  await sendMessage(chatId, "O que mais?", menuPrincipal().buttons, token);
}

async function processPerfil(chatId: string, token: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  if (!user) return sendMessage(chatId, "⚠️ Perfil não configurado.", menuConfig().buttons, token);

  const interests = user.interests?.filter((i) => i.active).map((i) => i.topic) || [];
  const settings = user.digestSettings || {};
  const msg = `👤 Perfil\n\n📛 ${user.name}\n📌 ${interests.join(", ") || "nenhum"}\n⏰ ${settings.cronSchedule || "08:00"}\n🎨 ${settings.summaryStyle || "bullet"}`;

  await sendMessage(chatId, msg, menuConfig().buttons, token);
}

async function processRemover(chatId: string, token: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  const interests = user?.interests?.filter((i) => i.active) || [];

  if (!interests.length) return sendSimple(chatId, "📌 Nada para remover.", token);

  const buttons: InlineButton[][] = interests.map((i) => [{ text: `❌ ${i.topic}`, callback_data: `remove_interest:${i.topic}` }]);
  buttons.push([{ text: "« Voltar", callback_data: "menu:config" }]);
  await sendMessage(chatId, "Qual remover?", buttons, token);
}

async function saveSettings(chatId: string, settings: Partial<{ cronSchedule: string; summaryStyle: string }>, token: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  const currentDigest = user?.digestSettings || {} as Record<string, unknown>;
  await createOrUpdateUser({
    telegramChatId: chatId,
    digestSettings: { ...currentDigest, ...settings },
  } as any);
  const [, hour] = (settings.cronSchedule || "08:00").split(" ");
  await sendMessage(chatId, `✅ ${settings.cronSchedule ? hour.padStart(2, "0") + ":00" : "Estilo: " + settings.summaryStyle}`, menuConfig().buttons, token);
}

async function removeInterest(chatId: string, topic: string, token: string): Promise<void> {
  const user = await findUserByChatId(chatId);
  const interests = (user?.interests || []).filter((i) => i.topic !== topic);
  await createOrUpdateUser({ ...user, telegramChatId: chatId, interests });
  await sendMessage(chatId, `❌ Removido: ${topic}`, menuPrincipal().buttons, token);
}

async function start(): Promise<void> {
  console.log("📨 Message Handler Worker starting...");
  await connectDB();
  await connectQueue();
  await consume<TelegramIncoming>(QUEUES.TELEGRAM_INCOMING, async (msg) => {
    if (msg.type === "callback") await handleCallback(msg);
    else if (msg.type === "message") await handleMessage(msg);
  });
  console.log("📨 Mensagens sendo processadas...");
}

start().catch((err) => {
  console.error("❌ Message Handler falhou:", err);
  process.exit(1);
});
