// src/digest/digest.js
// Busca notícias → gera resumo → envia Telegram

import { searchAllTopics } from './search.js';
import { generateDigest } from '../ai/llm.js';
import { sendLongTelegram } from '../telegram/telegram.js';
import { findAllActiveUsers, saveUser } from '../../models/UserPreferences.js';
import chalk from 'chalk';

export async function runDigestForAll(specificChatId = null) {
  console.log(chalk.bold.cyan('\n📰 Iniciando envio do Digest Diário...\n'));

  let users = await findAllActiveUsers();
  if (specificChatId) users = users.filter(u => u.telegramChatId === specificChatId.toString());

  if (!users.length) {
    console.log(chalk.yellow('Nenhum usuário ativo encontrado. Execute: npm run setup'));
    return;
  }

  console.log(`👥 ${users.length} usuário(s) encontrado(s)`);
  for (const user of users) await runDigestForUser(user);
  console.log(chalk.bold.green('\n✅ Digest concluído!\n'));
}

export async function runDigestForUser(user) {
  const topics = user.interests?.filter(i => i.active).map(i => i.topic) || [];
  if (!topics.length) {
    console.log(chalk.yellow(`⚠️  ${user.name}: Nenhum interesse ativo`));
    return;
  }

  console.log(chalk.bold(`\n👤 Processando digest para: ${user.name}`));
  console.log(`📌 Tópicos: ${topics.join(', ')}`);

  try {
    const searchResults = await searchAllTopics(topics, user.digestSettings?.maxArticlesPerTopic || 3);
    const digest = await generateDigest(searchResults, {
      name: user.name,
      summaryStyle: user.digestSettings?.summaryStyle,
      language: user.digestSettings?.language,
    });

    console.log(chalk.gray(`\n--- Prévia ---\n${digest.substring(0, 200)}...\n`));

    await sendLongTelegram(digest, user.telegramChatId, process.env.TELEGRAM_BOT_TOKEN);
    await sendSourcesList(searchResults, user.telegramChatId);
    await saveUser({ ...user, lastDigestSentAt: new Date() });
  } catch (err) {
    console.error(chalk.red(`❌ Erro ao processar digest para ${user.name}:`), err.message);
  }
}

async function sendSourcesList(searchResults, chatId) {
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
  await sendLongTelegram(msg, chatId);
}
