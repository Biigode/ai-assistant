// src/telegram-polling.js
// Polling do Telegram para receber mensagens

import fetch from 'node-fetch';
import { handleChatMessage, handleNewsDetail } from './chat.js';
import { handleCommand, handleInteractiveResponse } from './telegram-commands.js';

const TELEGRAM_API = 'https://api.telegram.org';
let offset = 0;
let isRunning = false;
let botToken = null;
const interactiveUsers = new Map();

export async function startPolling(token) {
  if (isRunning) return;
  isRunning = true;
  botToken = token;
  
  console.log('🔄 Iniciando polling do Telegram...');
  
  while (isRunning) {
    try {
      const updates = await getUpdates(token);
      
      for (const update of updates) {
        await processUpdate(update, token);
        offset = update.update_id + 1;
      }
    } catch (err) {
      console.error('❌ Erro no polling:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
}

export function stopPolling() {
  isRunning = false;
}

async function getUpdates(token) {
  const url = `${TELEGRAM_API}/bot${token}/getUpdates?timeout=60&offset=${offset}`;
  const res = await fetch(url);
  const body = await res.json();
  
  if (!body.ok) {
    throw new Error(body.description);
  }
  
  return body.result;
}

async function processUpdate(update, token) {
  if (!update.message || !update.message.text) return;
  
  const chatId = update.message.chat.id.toString();
  const text = update.message.text.trim();
  const name = update.message.chat.first_name || 'Usuário';
  
  console.log(`💬 Mensagem de ${name} (${chatId}): ${text}`);
  
  const currentStep = interactiveUsers.get(chatId);
  
  if (text.startsWith('/')) {
    const result = await handleCommand(chatId, text.toLowerCase(), token);
    
    if (result && result.step) {
      interactiveUsers.set(chatId, result);
    } else if (result === null) {
      await handleChatMessage(chatId, text, name);
    }
    return;
  }
  
  if (currentStep && currentStep.step) {
    const { findUserByChatId } = await import('../models/UserPreferences.js');
    const user = await findUserByChatId(chatId);
    
    const result = await handleInteractiveResponse(chatId, text, user, token, currentStep);
    
    if (result && result.step) {
      interactiveUsers.set(chatId, result);
    } else {
      interactiveUsers.delete(chatId);
    }
    return;
  }
  
  if (/^[1-5]$/.test(text)) {
    const handled = await handleNewsDetail(chatId, text, name);
    if (handled) return;
  }
  
  await handleChatMessage(chatId, text, name);
}
