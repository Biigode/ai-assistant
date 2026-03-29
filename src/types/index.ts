// src/types/index.ts
// Tipos de domínio centrais do projeto

import type { ObjectId } from "mongodb";

// ── MongoDB: userpreferences ─────────────────────────────────────────────────

export interface InterestEntry {
  topic: string;
  keywords: string[];
  active: boolean;
  addedAt: Date;
}

export interface DigestSettings {
  language: string;
  maxArticlesPerTopic: number;
  summaryStyle: "bullet-points" | "curto" | "detalhado";
  cronSchedule: string;
}

export interface UserPreference {
  _id?: ObjectId;
  telegramChatId: string;
  name: string;
  interests: InterestEntry[];
  digestSettings: DigestSettings;
  active: boolean;
  lastDigestSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── MongoDB: conversation_history ────────────────────────────────────────────

export interface ConversationMessage {
  _id?: ObjectId;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// ── Busca: resultado normalizado ─────────────────────────────────────────────

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  publishedAt: string | null;
}

// ── AI: model-router ─────────────────────────────────────────────────────────

export type ModelMode = "gpt-oss" | "qwen3.5" | "local";

export interface ModelConfig {
  ollama: import("ollama").Ollama;
  model: string;
  mode: ModelMode;
}

// ── AI: pipeline de research (agents.js) ─────────────────────────────────────

export interface VideoAngle {
  titulo: string;
  gancho: string;
  pontos: string[];
}

export interface Analysis {
  pontos_principais: string[];
  impacto_devs: string;
  alertas: string[];
  angulos_video: VideoAngle[];
  fontes_usadas: number[];
}

export interface AnalystResult {
  analysis: Analysis;
  sources: SearchResult[];
  mode: ModelMode | "fallback";
}

export interface Briefing {
  topic: string;
  briefing: string;
  analysis: Analysis;
  sources: SearchResult[];
  generatedAt: Date;
  model: ModelMode | "fallback";
}

// ── AI: LLM settings ────────────────────────────────────────────────────────

export interface ChatResponseSettings {
  name?: string;
  context?: string;
}

export interface DigestGenerationSettings {
  name?: string;
  summaryStyle?: string;
  language?: string;
}

// ── Busca: date context ──────────────────────────────────────────────────────

export interface DateContext {
  year: number;
  month: string;
  day: number;
  label: string;
}
