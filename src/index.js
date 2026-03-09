// src/index.js
// Ponto de entrada principal — inicializa o scheduler com node-cron + polling para chat

import 'dotenv/config';
import cron from 'node-cron';
import chalk from 'chalk';
import { connectDB } from './db.js';
import { checkOllama } from './llm.js';
import { runDigestForAll } from './digest.js';
import { findAllActiveUsers } from '../models/UserPreferences.js';
import { startPolling } from './telegram-polling.js';

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *';
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function bootstrap() {
  console.log(chalk.bold.cyan('╔══════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║      📰  Daily Digest Bot        ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════╝\n'));

  // 1. Verifica dependências
  await connectDB();
  await checkOllama();

  // 2. Mostra usuários configurados
  const users = await findAllActiveUsers();
  if (users.length === 0) {
    console.log(chalk.yellow('\n⚠️  Nenhum usuário configurado!'));
    console.log(chalk.cyan('Execute: npm run setup\n'));
  } else {
    console.log(chalk.bold(`\n👥 Usuários ativos: ${users.length}`));
    users.forEach(u => {
      const topics = u.interests?.filter(i => i.active).map(i => i.topic) || [];
      console.log(chalk.green(`  • ${u.name} (${u.telegramChatId}) — ${topics.length} tópico(s)`));
    });
  }

  // 3. Agenda o cron job
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(chalk.red(`❌ CRON_SCHEDULE inválido: "${CRON_SCHEDULE}"`));
    process.exit(1);
  }

  cron.schedule(CRON_SCHEDULE, () => {
    console.log(chalk.bold.cyan(`\n⏰ [${new Date().toLocaleString('pt-BR')}] Cron acionado!`));
    runDigestForAll();
  }, { timezone: TIMEZONE });

  // Mostra próximo disparo estimado
  const [min, hour] = CRON_SCHEDULE.split(' ');
  console.log(chalk.bold(`\n⏰ Agendamento: ${CRON_SCHEDULE} (${TIMEZONE})`));
  console.log(chalk.gray(`   Próximo envio: diariamente às ${hour.padStart(2,'0')}:${min.padStart(2,'0')}\n`));

  // 4. Inicia polling do Telegram para chat
  if (TELEGRAM_BOT_TOKEN) {
    startPolling(TELEGRAM_BOT_TOKEN);
  } else {
    console.log(chalk.yellow('⚠️  TELEGRAM_BOT_TOKEN não configurado. Chat desabilitado.\n'));
  }

  // 5. Opção de enviar imediatamente
  const args = process.argv.slice(2);
  if (args.includes('--now')) {
    console.log(chalk.bold.yellow('🚀 Flag --now detectada, enviando digest agora...\n'));
    await runDigestForAll();
  }

  console.log(chalk.bold.green('✅ Bot iniciado!'));
  console.log(chalk.gray('   Pressione Ctrl+C para parar.\n'));
}

bootstrap().catch(err => {
  console.error(chalk.red('Erro fatal:'), err);
  process.exit(1);
});
