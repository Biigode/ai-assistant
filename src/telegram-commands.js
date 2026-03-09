// src/telegram-commands.js
// Comandos interativos do Telegram para configurar interesses

import inquirer from 'inquirer';
import { findUserByChatId, createOrUpdateUser } from '../models/UserPreferences.js';
import { sendLongTelegram, sendTelegram } from './telegram.js';
import { extractInterests } from './llm.js';
import { searchTopic } from './search.js';

export async function handleCommand(chatId, command, botToken) {
  const user = await findUserByChatId(chatId);
  
  switch (command) {
    case '/start':
      return await handleStart(chatId, user, botToken);
      
    case '/interesses':
    case '/interests':
      return await handleInterests(chatId, user, botToken);
      
    case '/configurar':
    case '/setup':
      return await handleSetup(chatId, user, botToken);
      
    case '/adicionar':
    case '/add':
      return await handleAddInterest(chatId, user, botToken);
      
    case '/remover':
    case '/remove':
      return await handleRemoveInterest(chatId, user, botToken);
      
    case '/horario':
    case '/schedule':
      return await handleSchedule(chatId, user, botToken);
      
    case '/estilo':
    case '/style':
      return await handleStyle(chatId, user, botToken);
      
    case '/perfil':
    case '/profile':
      return await handleProfile(chatId, user, botToken);
      
    case '/help':
    case '/ajuda':
      return await handleHelp(chatId, botToken);
      
    case '/cancelar':
    case '/cancel':
      return await sendTelegram('✅ Operação cancelada.', chatId, botToken);
      
    default:
      return null;
  }
}

async function handleStart(chatId, user, botToken) {
  if (user) {
    return await sendTelegram(
      `👋 Olá ${user.name}! Bem-vindo de volta ao Daily Digest!\n\nSeus interesses atuais: ${user.interests?.filter(i => i.active).map(i => i.topic).join(', ') || 'nenhum'}\n\nDigite /help para ver os comandos disponíveis.`,
      chatId,
      botToken
    );
  }
  
  return await sendTelegram(
    `👋 Olá! Bem-vindo ao Daily Digest Bot!\n\nEu te ajudo a acompanhar notícias sobre seus interesses.\n\nConfigure seus interesses com /configurar e receba um digest diário!\n\nDigite /help para ver todos os comandos.`,
    chatId,
    botToken
  );
}

async function handleHelp(chatId, botToken) {
  const message = `📖 Comandos disponíveis:

/start - Iniciar ou reiniciar
/perfil - Ver seu perfil atual
/configurar - Configurar interesses (modo interativo)
/adicionar - Adicionar novo interesse
/remover - Remover interesse
/horario - Alterar horário do digest
/estilo - Alterar estilo do resumo

💬 Conversa livre:
Basta me enviar qualquer mensagem e eu responderei!

🔍 Buscas:
"Me conte sobre X" ou "buscar produto Y"`;

  return await sendLongTelegram(message, chatId, botToken);
}

async function handleProfile(chatId, user, botToken) {
  if (!user) {
    return await sendTelegram('❌ Você não tem um perfil configurado. Use /configurar para começar.', chatId, botToken);
  }
  
  const interests = user.interests?.filter(i => i.active).map(i => i.topic) || [];
  const settings = user.digestSettings || {};
  
  const message = `👤 Seu Perfil

📛 Nome: ${user.name}
📌 Interesses (${interests.length}):
${interests.map(i => `  • ${i}`).join('\n') || '  Nenhum'}
⏰ Horário: ${settings.cronSchedule || '08:00'}
📝 Estilo: ${settings.summaryStyle || 'bullet-points'}

Use /configurar para alterar tudo.`;
  
  return await sendLongTelegram(message, chatId, botToken);
}

async function handleInterests(chatId, user, botToken) {
  if (!user) {
    return await sendTelegram('❌ Configure primeiro com /configurar', chatId, botToken);
  }
  
  const interests = user.interests?.filter(i => i.active).map(i => i.topic) || [];
  
  if (interests.length === 0) {
    return await sendTelegram('📌 Você não tem interesses configurados. Use /adicionar para adicionar.', chatId, botToken);
  }
  
  return await sendLongTelegram(
    `📌 Seus interesses:\n\n${interests.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n/adicionar - Adicionar mais\n/remover - Remover algum`,
    chatId,
    botToken
  );
}

async function handleSetup(chatId, user, botToken) {
  await sendTelegram(
    '📝 Vamos configurar seu perfil!\n\nQual seu nome?',
    chatId,
    botToken
  );
  
  return { step: 'name', chatId };
}

async function handleAddInterest(chatId, user, botToken) {
  if (!user) {
    return await sendTelegram('❌ Configure primeiro com /configurar', chatId, botToken);
  }
  
  await sendTelegram(
    '📌 Qual interesse você quer adicionar?\n\nEx: "Tecnologia", "Receitas", "Esportes"\n\nOu me descreva em uma frase: "Gosto de cinema e música"',
    chatId,
    botToken
  );
  
  return { step: 'add_interest', chatId };
}

async function handleRemoveInterest(chatId, user, botToken) {
  if (!user) {
    return await sendTelegram('❌ Configure primeiro com /configurar', chatId, botToken);
  }
  
  const interests = user.interests?.filter(i => i.active) || [];
  
  if (interests.length === 0) {
    return await sendTelegram('📌 Você não tem interesses para remover.', chatId, botToken);
  }
  
  const options = interests.map(i => ({ name: i.topic, value: i.topic }));
  options.push({ name: 'Cancelar', value: 'cancel' });
  
  await sendLongTelegram(
    '❌ Qual interesse deseja remover?\n\n' + interests.map((i, idx) => `${idx + 1}. ${i.topic}`).join('\n'),
    chatId,
    botToken
  );
  
  return { step: 'remove_interest', chatId, interests };
}

async function handleSchedule(chatId, user, botToken) {
  if (!user) {
    return await sendTelegram('❌ Configure primeiro com /configurar', chatId, botToken);
  }
  
  await sendLongTelegram(
    '⏰ Qual horário você quer receber o digest?\n\n1. 🌅 07:00 - Bom dia\n2. ☀️ 08:00 - Manhã\n3. 🍽️ 12:00 - Almoço\n4. 🌆 18:00 - Fim de tarde\n\nResponda com o número (1-4) ou o horário (ex: "09:00")',
    chatId,
    botToken
  );
  
  return { step: 'schedule', chatId };
}

async function handleStyle(chatId, user, botToken) {
  if (!user) {
    return await sendTelegram('❌ Configure primeiro com /configurar', chatId, botToken);
  }
  
  await sendLongTelegram(
    '📝 Qual estilo de resumo você prefere?\n\n1. • Bullet points (padrão)\n2. 📄 Parágrafos curtos\n3. 📖 Parágrafos detalhados\n\nResponda com o número (1-3)',
    chatId,
    botToken
  );
  
  return { step: 'style', chatId };
}

export async function handleInteractiveResponse(chatId, response, user, botToken, currentStep) {
  const step = currentStep?.step;
  
  if (step === 'name') {
    const name = response;
    await sendTelegram(
      `Prazer, ${name}! 😊\n\nAgora me diga: sobre quais temas você quer receber notícias?\n\nEx: "Tecnologia, Esportes, Receitas" ou me descreva seus interesses de forma natural.`,
      chatId,
      botToken
    );
    return { step: 'interests', chatId, name };
  }
  
  if (step === 'interests') {
    const name = currentStep.name;
    const rawInput = response;
    
    let topics;
    try {
      topics = await extractInterests(rawInput);
    } catch (err) {
      topics = rawInput.split(',').map(t => t.trim()).filter(Boolean);
    }
    
    await sendLongTelegram(
      `📝 Interesses identificados:\n\n${topics.map(t => `• ${t}`).join('\n')}\n\nQual estilo de resumo prefere?\n\n1. • Bullet points (padrão)\n2. 📄 Parágrafos curtos\n3. 📖 Parágrafos detalhados\n\nResponda com o número (1-3)`,
      chatId,
      botToken
    );
    
    return { step: 'style', chatId, name, topics };
  }
  
  if (step === 'style') {
    const { name, topics } = currentStep;
    const styleMap = { '1': 'bullet-points', '2': 'curto', '3': 'detalhado' };
    const style = styleMap[response] || 'bullet-points';
    
    const styleNames = { 'bullet-points': 'Bullet points', 'curto': 'Parágrafos curtos', 'detalhado': 'Parágrafos detalhados' };
    
    await sendTelegram(
      `✅ Estilo: ${styleNames[style]}\n\nQual horário prefere receber o digest?\n\n1. 🌅 07:00\n2. ☀️ 08:00\n3. 🍽️ 12:00\n4. 🌆 18:00\n\nResponda com o número (1-4)`,
      chatId,
      botToken
    );
    
    return { step: 'schedule', chatId, name, topics, style };
  }
  
  if (step === 'schedule') {
    const { name, topics, style } = currentStep;
    const scheduleMap = { '1': '0 7 * * *', '2': '0 8 * * *', '3': '0 12 * * *', '4': '0 18 * * *' };
    const schedule = scheduleMap[response] || '0 8 * * *';
    
    const interests = topics.map(topic => ({ topic, active: true }));
    
    await createOrUpdateUser({
      telegramChatId: chatId,
      name,
      interests: [...(user?.interests || []), ...interests],
      digestSettings: {
        language: 'pt-BR',
        maxArticlesPerTopic: 3,
        summaryStyle: style,
        cronSchedule: schedule
      },
      active: true
    });
    
    await sendLongTelegram(
      `✅ Perfil configurado com sucesso!\n\n📛 Nome: ${name}\n📌 Interesses: ${topics.join(', ')}\n⏰ Horário: ${schedule}\n📝 Estilo: ${style}\n\nAgora você receberá um digest diário! Use /perfil para ver ou /adicionar para adicionar mais interesses.`,
      chatId,
      botToken
    );
    
    return { step: null, chatId };
  }
  
  if (step === 'add_interest') {
    const rawInput = response;
    let topics;
    try {
      topics = await extractInterests(rawInput);
    } catch {
      topics = rawInput.split(',').map(t => t.trim()).filter(Boolean);
    }
    
    const newInterests = [...(user?.interests || [])];
    for (const topic of topics) {
      if (!newInterests.find(i => i.topic.toLowerCase() === topic.toLowerCase())) {
        newInterests.push({ topic, active: true });
      }
    }
    
    await createOrUpdateUser({
      ...user,
      telegramChatId: chatId,
      interests: newInterests
    });
    
    return await sendLongTelegram(
      `✅ Interesses adicionados: ${topics.join(', ')}\n\nSeus interesses agora: ${newInterests.filter(i => i.active).map(i => i.topic).join(', ')}`,
      chatId,
      botToken
    );
  }
  
  if (step === 'schedule' && currentStep?.chatId === chatId) {
    const scheduleMap = { '1': '0 7 * * *', '2': '0 8 * * *', '3': '0 12 * * *', '4': '0 18 * * *', '07:00': '0 7 * * *', '08:00': '0 8 * * *', '12:00': '0 12 * * *', '18:00': '0 18 * * *' };
    const schedule = scheduleMap[response] || response;
    
    if (user) {
      await createOrUpdateUser({
        ...user,
        telegramChatId: chatId,
        digestSettings: {
          ...user.digestSettings,
          cronSchedule: schedule
        }
      });
    }
    
    return await sendTelegram(`✅ Horário alterado para: ${schedule}`, chatId, botToken);
  }
  
  if (step === 'style' && currentStep?.chatId === chatId) {
    const styleMap = { '1': 'bullet-points', '2': 'curto', '3': 'detalhado' };
    const style = styleMap[response] || response;
    
    if (user) {
      await createOrUpdateUser({
        ...user,
        telegramChatId: chatId,
        digestSettings: {
          ...user.digestSettings,
          summaryStyle: style
        }
      });
    }
    
    return await sendTelegram(`✅ Estilo alterado para: ${style}`, chatId, botToken);
  }
  
  return null;
}
