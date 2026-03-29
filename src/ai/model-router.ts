// src/ai/model-router.ts
// Roteador de modelos — uma única OLLAMA_API_KEY serve para cloud E web search.
//
// Hierarquia por tipo de tarefa:
//   Raciocínio (agentes, briefings): gpt-oss:20b-cloud → qwen3.5 → local
//   Chat/Digest (tarefas simples):   qwen3.5:4b-cloud  → gpt-oss → local

import { Ollama } from "ollama";
import type { ModelConfig } from "../types/index.ts";

const LOCAL_HOST = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const CLOUD_HOST = process.env.OLLAMA_CLOUD_URL || "https://ollama.com";
const CLOUD_KEY = process.env.OLLAMA_API_KEY;

export const MODEL = {
  reasoning: process.env.OLLAMA_MODEL_REASONING || "gpt-oss:20b-cloud",
  chat: process.env.OLLAMA_MODEL_CHAT || "qwen3.5:4b-cloud",
  local: process.env.OLLAMA_MODEL || "qwen2.5:3b",
} as const;

export const ollamaLocal = new Ollama({ host: LOCAL_HOST });
export const ollamaCloud = new Ollama({ host: CLOUD_HOST });

const cache = new Map<string, { ok: boolean; ts: number }>();
const TTL = 5 * 60 * 1000;

async function isAvailable(model: string): Promise<boolean> {
  if (!CLOUD_KEY) return false;
  const hit = cache.get(model);
  if (hit && Date.now() - hit.ts < TTL) return hit.ok;
  try {
    await ollamaCloud.generate({
      model,
      prompt: "hi",
      options: { num_predict: 1 },
    });
    cache.set(model, { ok: true, ts: Date.now() });
    return true;
  } catch {
    cache.set(model, { ok: false, ts: Date.now() });
    return false;
  }
}

export function invalidateCache(): void {
  cache.clear();
}

export async function getReasoningModel(): Promise<ModelConfig> {
  if (await isAvailable(MODEL.reasoning)) {
    console.log(`🧠 Usando: ${MODEL.reasoning} (cloud)`);
    return { ollama: ollamaCloud, model: MODEL.reasoning, mode: "gpt-oss" };
  }
  if (await isAvailable(MODEL.chat)) {
    console.log(`☁️  Usando: ${MODEL.chat} (cloud — fallback)`);
    return { ollama: ollamaCloud, model: MODEL.chat, mode: "qwen3.5" };
  }
  console.log(`💻 Usando: ${MODEL.local} (local)`);
  return { ollama: ollamaLocal, model: MODEL.local, mode: "local" };
}

export async function getActiveModel(): Promise<ModelConfig> {
  if (await isAvailable(MODEL.chat)) {
    return { ollama: ollamaCloud, model: MODEL.chat, mode: "qwen3.5" };
  }
  if (await isAvailable(MODEL.reasoning)) {
    return { ollama: ollamaCloud, model: MODEL.reasoning, mode: "gpt-oss" };
  }
  return { ollama: ollamaLocal, model: MODEL.local, mode: "local" };
}

export async function checkCloudAvailable(): Promise<boolean> {
  return (
    (await isAvailable(MODEL.chat)) || (await isAvailable(MODEL.reasoning))
  );
}

export interface ModelsStatus {
  reasoning: { model: string; available: boolean };
  chat: { model: string; available: boolean };
  local: { model: string; available: boolean };
  active: string;
  cloudKey: boolean;
}

export async function getModelsStatus(): Promise<ModelsStatus> {
  const reasoningOk = await isAvailable(MODEL.reasoning);
  const chatOk = await isAvailable(MODEL.chat);
  const active = reasoningOk
    ? MODEL.reasoning
    : chatOk
      ? MODEL.chat
      : MODEL.local;
  return {
    reasoning: { model: MODEL.reasoning, available: reasoningOk },
    chat: { model: MODEL.chat, available: chatOk },
    local: { model: MODEL.local, available: true },
    active,
    cloudKey: !!CLOUD_KEY,
  };
}
