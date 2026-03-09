// src/setup.js
// Script interativo para configurar interesses via terminal
// Usa LLM local para extrair tópicos de linguagem natural

import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { connectDB, disconnectDB } from './db.js';
import { extractInterests, checkOllama } from './llm.js';
import { findUserByChatId, createOrUpdateUser } from '../models/UserPreferences.js';

async function main() {
  console.log(chalk.bold.cyan('\n🗞️  Daily Digest — Configuração de Interesses\n'));

  // 1. Verifica dependências
  const ollamaOk = await checkOllama();
  await connectDB();

  // 2. Dados do usuário
  const { telegramChatId, name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'telegramChatId',
      message: 'Seu Chat ID do Telegram ( converse com @userinfobot para descobrir):',
      validate: v => v.replace(/\D/g, '').length >= 5 || 'Chat ID inválido',
      filter: v => v.replace(/\D/g, ''),
    },
    {
      type: 'input',
      name: 'name',
      message: 'Seu nome:',
      validate: v => v.trim().length > 0 || 'Nome obrigatório',
    },
  ]);

  // 3. Verifica se já existe perfil
  let user = await findUserByChatId(telegramChatId);
  let replaceInterests = false;

  if (user) {
    console.log(chalk.yellow(`\n⚠️  Perfil existente para ${user.name} (${telegramChatId})`));
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'O que deseja fazer?',
      choices: [
        { name: 'Adicionar novos interesses', value: 'add' },
        { name: 'Substituir todos os interesses', value: 'replace' },
        { name: 'Ver interesses atuais', value: 'view' },
        { name: 'Cancelar', value: 'cancel' },
      ],
    }]);

    if (action === 'cancel') {
      console.log(chalk.gray('Operação cancelada.'));
      await disconnectDB();
      process.exit(0);
    }

    if (action === 'view') {
      console.log(chalk.bold('\n📌 Seus interesses atuais:'));
      const topics = user.interests?.filter(i => i.active).map(i => i.topic) || [];
      topics.forEach(t => console.log(chalk.green(`  • ${t}`)));
      await disconnectDB();
      return;
    }

    replaceInterests = (action === 'replace');
  }

  // 4. Captura interesses em linguagem natural
  console.log(chalk.bold('\n💬 Fale sobre seus interesses livremente:'));
  console.log(chalk.gray('Ex: "Gosto de inteligência artificial, mercado de ações e Fórmula 1"\n'));

  const { rawInput } = await inquirer.prompt([{
    type: 'input',
    name: 'rawInput',
    message: 'Seus interesses:',
    validate: v => v.trim().length > 5 || 'Descreva ao menos um interesse',
  }]);

  // 5. LLM extrai os tópicos
  let topics;
  if (ollamaOk) {
    console.log(chalk.cyan('\n🤖 Analisando com LLM local...'));
    topics = await extractInterests(rawInput);
  } else {
    console.log(chalk.yellow('\n⚠️  Ollama indisponível, usando separação por vírgula como fallback'));
    topics = rawInput.split(',').map(t => t.trim()).filter(Boolean);
  }

  // 6. Confirma os tópicos extraídos
  console.log(chalk.bold('\n📝 Tópicos identificados:'));
  topics.forEach(t => console.log(chalk.green(`  • ${t}`)));

  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: 'Estes tópicos estão corretos?',
    default: true,
  }]);

  if (!confirmed) {
    const { manual } = await inquirer.prompt([{
      type: 'input',
      name: 'manual',
      message: 'Digite os tópicos separados por vírgula:',
    }]);
    topics = manual.split(',').map(t => t.trim()).filter(Boolean);
  }

  // 7. Configurações de estilo
  const { summaryStyle, schedule } = await inquirer.prompt([
    {
      type: 'list',
      name: 'summaryStyle',
      message: 'Estilo do resumo:',
      choices: [
        { name: '• Bullet points (padrão)', value: 'bullet-points' },
        { name: '📄 Parágrafos curtos', value: 'curto' },
        { name: '📖 Parágrafos detalhados', value: 'detalhado' },
      ],
    },
    {
      type: 'list',
      name: 'schedule',
      message: 'Horário de envio:',
      choices: [
        { name: '🌅 07:00 — Bom dia', value: '0 7 * * *' },
        { name: '☀️  08:00 — Manhã', value: '0 8 * * *' },
        { name: '🍽️  12:00 — Almoço', value: '0 12 * * *' },
        { name: '🌆 18:00 — Fim de tarde', value: '0 18 * * *' },
      ],
    },
  ]);

  // 8. Salva no MongoDB Atlas
  const interests = topics.map(topic => ({ topic, active: true }));

  const userData = {
    telegramChatId,
    name,
    interests: replaceInterests ? interests : [...(user?.interests || []), ...interests],
    digestSettings: {
      language: 'pt-BR',
      maxArticlesPerTopic: 3,
      summaryStyle,
      cronSchedule: schedule
    },
    active: true
  };

  await createOrUpdateUser(userData);

  console.log(chalk.bold.green('\n✅ Perfil salvo com sucesso no MongoDB Atlas!'));
  console.log(chalk.cyan(`\n🚀 Execute ${chalk.bold('npm start')} para iniciar o digest diário.\n`));

  await disconnectDB();
}

main().catch(err => {
  console.error(chalk.red('Erro fatal:'), err);
  process.exit(1);
});
