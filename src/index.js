// src/index.js
// Ponto de entrada — polling do Telegram + cron do digest

import 'dotenv/config';
import cron from 'node-cron';
import chalk from 'chalk';
import { connectDB } from './core/db.js';
import { checkOllama } from './ai/llm.js';
import { runDigestForAll } from './digest/digest.js';
import { startPolling } from './telegram/polling.js';
import { getModelsStatus } from './ai/model-router.js';
import { registerBotCommands } from './telegram/telegram.js';
import { findAllActiveUsers } from '../models/UserPreferences.js';

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';
const TIMEZONE      = process.env.TIMEZONE      || 'America/Sao_Paulo';
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;

async function bootstrap() {
  console.log(chalk.bold.cyan('╔══════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║      📰  Daily Digest Bot v2         ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════╝\n'));

  await connectDB();
  await checkOllama();

  if (!BOT_TOKEN) {
    console.error(chalk.red('❌ TELEGRAM_BOT_TOKEN não configurado no .env'));
    process.exit(1);
  }

  // Status dos modelos
  console.log(chalk.bold('\n🤖 Status dos modelos:'));
  const status = await getModelsStatus();
  const icon = (ok) => ok ? chalk.green('✅') : chalk.gray('○ ');
  console.log(`  ${icon(status.reasoning.available)} ${status.reasoning.model.padEnd(22)} (cloud — raciocínio)`);
  console.log(`  ${icon(status.chat.available)}      ${status.chat.model.padEnd(22)} (cloud — chat/digest)`);
  console.log(`  ${icon(status.local.available)}      ${status.local.model.padEnd(22)} (local — sempre disponível)`);
  console.log(chalk.bold(`\n  Ativo agora: ${chalk.cyan(status.active)}\n`));

  if (!status.reasoning.available && !status.chat.available) {
    console.log(chalk.yellow('  💡 Configure OLLAMA_API_KEY no .env para ativar os modelos cloud'));
    console.log(chalk.gray('     Crie sua key em https://ollama.com → Settings → API Keys\n'));
  }

  // Usuários configurados
  const users = await findAllActiveUsers();
  if (!users.length) {
    console.log(chalk.yellow('⚠️  Nenhum usuário configurado! Execute: npm run setup\n'));
  } else {
    console.log(chalk.bold(`👥 Usuários ativos: ${users.length}`));
    users.forEach(u => {
      const topics = u.interests?.filter(i => i.active).map(i => i.topic) || [];
      console.log(chalk.green(`  • ${u.name} (${u.telegramChatId}) — ${topics.length} tópico(s)`));
    });
    console.log();
  }

  // Cron
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(chalk.red(`❌ CRON_SCHEDULE inválido: "${CRON_SCHEDULE}"`));
    process.exit(1);
  }
  cron.schedule(CRON_SCHEDULE, () => {
    console.log(chalk.bold.cyan(`\n⏰ [${new Date().toLocaleString('pt-BR')}] Enviando digest...`));
    runDigestForAll().catch(err => console.error(chalk.red('❌ Erro no digest:'), err.message));
  }, { timezone: TIMEZONE });

  const [min, hour] = CRON_SCHEDULE.split(' ');
  console.log(chalk.bold(`⏰ Digest agendado: todo dia às ${hour.padStart(2,'0')}:${min.padStart(2,'0')} (${TIMEZONE})`));

  await registerBotCommands(BOT_TOKEN);
  startPolling(BOT_TOKEN);

  if (process.argv.includes('--now')) {
    console.log(chalk.bold.yellow('\n🚀 --now: enviando digest agora...\n'));
    await runDigestForAll();
  }

  console.log(chalk.bold.green('\n✅ Bot iniciado! Pressione Ctrl+C para parar.\n'));
  process.on('SIGINT', () => { console.log(chalk.yellow('\n👋 Encerrando...')); process.exit(0); });
}

bootstrap().catch(err => {
  console.error(chalk.red('Erro fatal:'), err);
  process.exit(1);
});
