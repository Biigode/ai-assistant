// Script para criar usuário de teste
import 'dotenv/config';
import { connectDB, disconnectDB } from './src/db.js';
import { createOrUpdateUser } from './models/UserPreferences.js';

async function main() {
  await connectDB();

  const userData = {
    telegramChatId: '7502708962',
    name: 'Victor',
    interests: [
      { topic: 'Tecnologia', active: true },
      { topic: 'Inteligência Artificial', active: true },
      { topic: 'Programação', active: true }
    ],
    digestSettings: {
      language: 'pt-BR',
      maxArticlesPerTopic: 3,
      summaryStyle: 'bullet-points',
      cronSchedule: '0 8 * * *'
    },
    active: true
  };

  await createOrUpdateUser(userData);
  console.log('✅ Usuário criado com sucesso!');
  
  await disconnectDB();
}

main().catch(console.error);
