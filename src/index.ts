// src/index.ts
// Ponto de entrada — polling do Telegram + cron do resumo

import chalk from "chalk";
import "dotenv/config";
import cron from "node-cron";
import { checkOllama } from "./ai/llm.ts";
import { getModelsStatus } from "./ai/model-router.ts";
import { connectDB } from "./core/db.ts";
import { runDigestForAll } from "./features/news/summary.ts";
import { findAllActiveUsers } from "./models/UserPreferences.ts";
import { startPolling } from "./telegram/polling.ts";
import { registerBotCommands } from "./telegram/telegram-api.ts";

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 8 * * *";
const TIMEZONE = process.env.TIMEZONE || "America/Sao_Paulo";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function bootstrap(): Promise<void> {
  console.log(chalk.bold.cyan("╔══════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║      📰  Daily Resumo Bot v2         ║"));
  console.log(chalk.bold.cyan("╚══════════════════════════════════════╝\n"));

  await connectDB();
  await checkOllama();

  if (!BOT_TOKEN) {
    console.error(chalk.red("❌ TELEGRAM_BOT_TOKEN não configurado no .env"));
    process.exit(1);
  }

  // Status dos modelos
  console.log(chalk.bold("\n🤖 Status dos modelos:"));
  const status = await getModelsStatus();
  const icon = (ok: boolean) => (ok ? chalk.green("✅") : chalk.gray("○ "));
  console.log(
    `  ${icon(status.reasoning.available)} ${status.reasoning.model.padEnd(22)} (cloud — raciocínio)`,
  );
  console.log(
    `  ${icon(status.chat.available)}      ${status.chat.model.padEnd(22)} (cloud — chat/resumo)`,
  );
  console.log(
    `  ${icon(status.local.available)}      ${status.local.model.padEnd(22)} (local — sempre disponível)`,
  );
  console.log(chalk.bold(`\n  Ativo agora: ${chalk.cyan(status.active)}\n`));

  if (!status.reasoning.available && !status.chat.available) {
    console.log(
      chalk.yellow(
        "  💡 Configure OLLAMA_API_KEY no .env para ativar os modelos cloud",
      ),
    );
    console.log(
      chalk.gray(
        "     Crie sua key em https://ollama.com → Settings → API Keys\n",
      ),
    );
  }

  // Usuários configurados
  const users = await findAllActiveUsers();
  if (!users.length) {
    console.log(
      chalk.yellow("⚠️  Nenhum usuário configurado! Execute: npm run setup\n"),
    );
  } else {
    console.log(chalk.bold(`👥 Usuários ativos: ${users.length}`));
    users.forEach((u) => {
      const topics =
        u.interests?.filter((i) => i.active).map((i) => i.topic) || [];
      console.log(
        chalk.green(
          `  • ${u.name} (${u.telegramChatId}) — ${topics.length} tópico(s)`,
        ),
      );
    });
    console.log();
  }

  // Cron
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(chalk.red(`❌ CRON_SCHEDULE inválido: "${CRON_SCHEDULE}"`));
    process.exit(1);
  }
  cron.schedule(
    CRON_SCHEDULE,
    () => {
      console.log(
        chalk.bold.cyan(
          `\n⏰ [${new Date().toLocaleString("pt-BR")}] Enviando resumo...`,
        ),
      );
      runDigestForAll().catch((err: Error) =>
        console.error(chalk.red("❌ Erro no resumo:"), err.message),
      );
    },
    { timezone: TIMEZONE },
  );

  const [min, hour] = CRON_SCHEDULE.split(" ");
  console.log(
    chalk.bold(
      `⏰ Resumo agendado: todo dia às ${hour.padStart(2, "0")}:${min.padStart(2, "0")} (${TIMEZONE})`,
    ),
  );

  try {
    await registerBotCommands(BOT_TOKEN);
  } catch (err) {
    console.warn(
      chalk.yellow(
        "⚠️  Não foi possível registrar comandos do bot:",
        (err as Error).message,
      ),
    );
  }
  startPolling(BOT_TOKEN);

  if (process.argv.includes("--now")) {
    console.log(chalk.bold.yellow("\n🚀 --now: enviando resumo agora...\n"));
    await runDigestForAll();
  }

  console.log(
    chalk.bold.green("\n✅ Bot iniciado! Pressione Ctrl+C para parar.\n"),
  );
  process.on("SIGINT", () => {
    console.log(chalk.yellow("\n👋 Encerrando..."));
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error(chalk.red("Erro fatal:"), err);
  process.exit(1);
});
