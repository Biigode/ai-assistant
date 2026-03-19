// src/ai/model-router.js
// Roteador de modelos — uma única OLLAMA_API_KEY serve para cloud E web search.
//
// Hierarquia por tipo de tarefa:
//   Raciocínio (agentes, briefings): gpt-oss:20b-cloud → qwen3.5 → local
//   Chat/Digest (tarefas simples):   qwen3.5:4b-cloud  → gpt-oss → local

import { Ollama } from 'ollama';

const LOCAL_HOST = process.env.OLLAMA_BASE_URL  || 'http://localhost:11434';
const CLOUD_HOST = process.env.OLLAMA_CLOUD_URL || 'https://ollama.com';
const CLOUD_KEY  = process.env.OLLAMA_API_KEY;

const MODEL = {
  reasoning: process.env.OLLAMA_MODEL_REASONING || 'gpt-oss:20b-cloud',
  chat:      process.env.OLLAMA_MODEL_CHAT      || 'qwen3.5:4b-cloud',
  local:     process.env.OLLAMA_MODEL           || 'qwen2.5:3b',
};

const ollamaLocal = new Ollama({ host: LOCAL_HOST });
const ollamaCloud = new Ollama({ host: CLOUD_HOST });

const cache = new Map();
const TTL = 5 * 60 * 1000;

async function isAvailable(model) {
  if (!CLOUD_KEY) return false;
  const hit = cache.get(model);
  if (hit && Date.now() - hit.ts < TTL) return hit.ok;
  try {
    await ollamaCloud.generate({ model, prompt: 'hi', options: { num_predict: 1 } });
    cache.set(model, { ok: true, ts: Date.now() });
    return true;
  } catch {
    cache.set(model, { ok: false, ts: Date.now() });
    return false;
  }
}

export function invalidateCache() { cache.clear(); }

export async function getReasoningModel() {
  if (await isAvailable(MODEL.reasoning)) {
    console.log(`🧠 Usando: ${MODEL.reasoning} (cloud)`);
    return { ollama: ollamaCloud, model: MODEL.reasoning, mode: 'gpt-oss' };
  }
  if (await isAvailable(MODEL.chat)) {
    console.log(`☁️  Usando: ${MODEL.chat} (cloud — fallback)`);
    return { ollama: ollamaCloud, model: MODEL.chat, mode: 'qwen3.5' };
  }
  console.log(`💻 Usando: ${MODEL.local} (local)`);
  return { ollama: ollamaLocal, model: MODEL.local, mode: 'local' };
}

export async function getActiveModel() {
  if (await isAvailable(MODEL.chat)) {
    return { ollama: ollamaCloud, model: MODEL.chat, mode: 'qwen3.5' };
  }
  if (await isAvailable(MODEL.reasoning)) {
    return { ollama: ollamaCloud, model: MODEL.reasoning, mode: 'gpt-oss' };
  }
  return { ollama: ollamaLocal, model: MODEL.local, mode: 'local' };
}

export async function checkCloudAvailable() {
  return (await isAvailable(MODEL.chat)) || (await isAvailable(MODEL.reasoning));
}

export async function getModelsStatus() {
  const reasoningOk = await isAvailable(MODEL.reasoning);
  const chatOk      = await isAvailable(MODEL.chat);
  const active      = reasoningOk ? MODEL.reasoning : chatOk ? MODEL.chat : MODEL.local;
  return {
    reasoning: { model: MODEL.reasoning, available: reasoningOk },
    chat:      { model: MODEL.chat,      available: chatOk      },
    local:     { model: MODEL.local,     available: true        },
    active,
    cloudKey:  !!CLOUD_KEY,
  };
}

export { ollamaLocal, ollamaCloud, MODEL };
