// src/features/news/summary.ts
// Busca notícias → gera resumo → envia Telegram

import chalk from "chalk";
import { generateDigest } from "../../ai/llm.ts";
import { findAllActiveUsers, saveUser } from "../../models/UserPreferences.ts";
import { sendLongMessage } from "../../telegram/telegram-api.ts";
import type { SearchResult, UserPreference } from "../../types/index.ts";
import { searchAllTopics } from "../core/search.ts";

export async function runDigestForAll(
  specificChatId: string | null = null,
): Promise<void> {
  console.log(chalk.bold.cyan("\n📰 Iniciando envio do Resumo Diário...\n"));

  let users = await findAllActiveUsers();
  if (specificChatId)
    users = users.filter((u) => u.telegramChatId === specificChatId.toString());

  if (!users.length) {
    console.log(
      chalk.yellow("Nenhum usuário ativo encontrado. Execute: npm run setup"),
    );
    return;
  }

  console.log(`👥 ${users.length} usuário(s) encontrado(s)`);
  for (const user of users) await runDigestForUser(user);
  console.log(chalk.bold.green("\n✅ Resumo concluído!\n"));
}

export async function runDigestForUser(user: UserPreference): Promise<void> {
  const topics =
    user.interests?.filter((i) => i.active).map((i) => i.topic) || [];
  if (!topics.length) {
    console.log(chalk.yellow(`⚠️  ${user.name}: Nenhum interesse ativo`));
    return;
  }

  console.log(chalk.bold(`\n👤 Processando resumo para: ${user.name}`));
  console.log(`📌 Tópicos: ${topics.join(", ")}`);

  try {
    const searchResults = await searchAllTopics(
      topics,
      user.digestSettings?.maxArticlesPerTopic || 3,
    );
    const digest = await generateDigest(searchResults, {
      name: user.name,
      summaryStyle: user.digestSettings?.summaryStyle,
      language: user.digestSettings?.language,
    });

    console.log(
      chalk.gray(`\n--- Prévia ---\n${digest.substring(0, 200)}...\n`),
    );

    await sendLongMessage(
      digest,
      user.telegramChatId,
      process.env.TELEGRAM_BOT_TOKEN,
    );
    await sendSourcesList(searchResults, user.telegramChatId);
    await saveUser({ ...user, lastDigestSentAt: new Date() });
  } catch (err) {
    console.error(
      chalk.red(`❌ Erro ao processar resumo para ${user.name}:`),
      (err as Error).message,
    );
  }
}

async function sendSourcesList(
  searchResults: Record<string, SearchResult[]>,
  chatId: string,
): Promise<void> {
  let msg = `\n📋 Fontes e Links\n\n⚠️ Sempre verifique as fontes antes de compartilhar!\n\n`;
  let count = 1;
  for (const [topic, articles] of Object.entries(searchResults)) {
    if (!articles.length) continue;
    msg += `${topic}:\n`;
    for (const a of articles) {
      msg += `${count}. ${a.title}\n   📰 ${a.source}\n   🔗 ${a.link}\n\n`;
      count++;
    }
  }
  await sendLongMessage(msg, chatId);
}
