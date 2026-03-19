// src/setup.js
// Script CLI para configurar interesses via terminal

import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { connectDB, disconnectDB } from './core/db.js';
import { extractInterests, checkOllama } from './ai/llm.js';
import { findUserByChatId, createOrUpdateUser } from '../models/UserPreferences.js';

async function main() {
  console.log(chalk.bold.cyan('\n🗞️  Daily Digest — Configuração de Interesses\n'));

  const ollamaOk = await checkOllama();
  await connectDB();

  const { telegramChatId, name } = await inquirer.prompt([
    { type: 'input', name: 'telegramChatId', message: 'Chat ID do Telegram (@userinfobot para descobrir):', validate: v => v.replace(/\D/g, '').length >= 5 || 'Chat ID inválido', filter: v => v.replace(/\D/g, '') },
    { type: 'input', name: 'name', message: 'Seu nome:', validate: v => v.trim().length > 0 || 'Nome obrigatório' },
  ]);

  let user = await findUserByChatId(telegramChatId);
  let replaceInterests = false;

  if (user) {
    console.log(chalk.yellow(`\n⚠️  Perfil existente para ${user.name}`));
    const { action } = await inquirer.prompt([{ type: 'list', name: 'action', message: 'O que deseja fazer?', choices: [
      { name: 'Adicionar novos interesses', value: 'add' },
      { name: 'Substituir todos os interesses', value: 'replace' },
      { name: 'Ver interesses atuais', value: 'view' },
      { name: 'Cancelar', value: 'cancel' },
    ]}]);

    if (action === 'cancel') { await disconnectDB(); process.exit(0); }
    if (action === 'view') {
      const topics = user.interests?.filter(i => i.active).map(i => i.topic) || [];
      topics.forEach(t => console.log(chalk.green(`  • ${t}`)));
      await disconnectDB();
      return;
    }
    replaceInterests = (action === 'replace');
  }

  const { rawInput } = await inquirer.prompt([{ type: 'input', name: 'rawInput', message: 'Seus interesses (ex: "IA, mercado financeiro, F1"):', validate: v => v.trim().length > 5 || 'Descreva ao menos um interesse' }]);

  let topics = ollamaOk ? await extractInterests(rawInput) : rawInput.split(',').map(t => t.trim()).filter(Boolean);

  console.log(chalk.bold('\n📝 Tópicos identificados:'));
  topics.forEach(t => console.log(chalk.green(`  • ${t}`)));

  const { confirmed } = await inquirer.prompt([{ type: 'confirm', name: 'confirmed', message: 'Estes tópicos estão corretos?', default: true }]);
  if (!confirmed) {
    const { manual } = await inquirer.prompt([{ type: 'input', name: 'manual', message: 'Digite os tópicos separados por vírgula:' }]);
    topics = manual.split(',').map(t => t.trim()).filter(Boolean);
  }

  const { summaryStyle, schedule } = await inquirer.prompt([
    { type: 'list', name: 'summaryStyle', message: 'Estilo do resumo:', choices: [
      { name: '• Bullet points (padrão)', value: 'bullet-points' },
      { name: '📄 Parágrafos curtos', value: 'curto' },
      { name: '📖 Parágrafos detalhados', value: 'detalhado' },
    ]},
    { type: 'list', name: 'schedule', message: 'Horário de envio:', choices: [
      { name: '🌅 07:00', value: '0 7 * * *' },
      { name: '☀️  08:00', value: '0 8 * * *' },
      { name: '🍽️  12:00', value: '0 12 * * *' },
      { name: '🌆 18:00', value: '0 18 * * *' },
    ]},
  ]);

  const interests = topics.map(topic => ({ topic, active: true }));
  await createOrUpdateUser({
    telegramChatId, name,
    interests: replaceInterests ? interests : [...(user?.interests || []), ...interests],
    digestSettings: { language: 'pt-BR', maxArticlesPerTopic: 3, summaryStyle, cronSchedule: schedule },
    active: true,
  });

  console.log(chalk.bold.green('\n✅ Perfil salvo com sucesso!'));
  console.log(chalk.cyan(`\n🚀 Execute ${chalk.bold('npm start')} para iniciar o bot.\n`));
  await disconnectDB();
}

main().catch(err => { console.error(chalk.red('Erro fatal:'), err); process.exit(1); });
