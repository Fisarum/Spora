export type Provider = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ProviderKey {
  id: string;
  provider: Provider;
  label: string;
  maskedKey: string;
  createdAt: number;
}

export interface SporaKey {
  id: string;
  token: string;
  label: string;
  location: string;
  allowedProviders: Provider[] | null;
  allowedModels: string[] | null;
  dailyLimitUsd: number | null;
  monthlyLimitUsd: number | null;
  createdAt: number;
  active: boolean;
}

export interface RequestLog {
  id: string;
  sporaKeyId: string | null;
  sporaKeyLabel: string | null;
  provider: Provider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  statusCode: number;
  ts: number;
  requestBody?: string;
  responseBody?: string;
}

export interface UsageStats {
  totalRequests: number;
  totalCostUsd: number;
  totalTokens: number;
  avgLatencyMs: number;
}

export interface ProviderUsage {
  provider: string;
  requests: number;
  costUsd: number;
  tokens: number;
}

export interface ModelUsage {
  model: string;
  provider: string;
  requests: number;
  costUsd: number;
  tokens: number;
}

export interface KeyUsage {
  sporaKeyId: string;
  label: string;
  location: string;
  requests: number;
  costUsd: number;
  tokens: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  costUsd: number;
  tokens: number;
}

export type ModelTag = "Coding" | "Reasoning" | "Fast" | "Free" | "Vision";

export interface Model {
  id: string;
  name: string;
  provider: string;
  sporaProvider: string;
  contextLength: number;
  modality: string;
  description: string;
  promptPrice: number;
  completionPrice: number;
  tags: ModelTag[];
}

export interface GatewaySettings {
  retryCount: number;
  timeoutSeconds: number;
  semanticCacheEnabled: boolean;
  mcpEnabled: boolean;
  dataRetentionDays: number;
  gatewayPort: number;
}
