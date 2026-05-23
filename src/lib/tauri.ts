import { invoke } from "@tauri-apps/api/core";
import type {
  ProviderKey,
  SporaKey,
  RequestLog,
  UsageStats,
  ProviderUsage,
  ModelUsage,
  KeyUsage,
  DailyUsage,
  GatewaySettings,
  Provider,
  Model,
} from "./types";

export const keysApi = {
  listProviderKeys: (): Promise<ProviderKey[]> =>
    invoke("list_provider_keys"),

  addProviderKey: (
    provider: Provider,
    label: string,
    apiKey: string
  ): Promise<ProviderKey> =>
    invoke("add_provider_key", { provider, label, apiKey }),

  updateProviderKey: (params: {
    id: string;
    provider: Provider;
    label: string;
    apiKey?: string;
  }): Promise<void> => invoke("update_provider_key", { params }),

  deleteProviderKey: (id: string): Promise<void> =>
    invoke("delete_provider_key", { id }),

  listSporaKeys: (): Promise<SporaKey[]> =>
    invoke("list_spora_keys"),

  createSporaKey: (params: {
    label: string;
    location: string;
    allowedProviders: Provider[] | null;
    allowedModels: string[] | null;
    dailyLimitUsd: number | null;
    monthlyLimitUsd: number | null;
  }): Promise<SporaKey> => invoke("create_spora_key", { params }),

  updateSporaKey: (params: {
    id: string;
    label: string;
    location: string;
    allowedProviders: Provider[] | null;
    allowedModels: string[] | null;
    dailyLimitUsd: number | null;
    monthlyLimitUsd: number | null;
  }): Promise<void> => invoke("update_spora_key", { params }),

  revokeSporaKey: (id: string): Promise<void> =>
    invoke("revoke_spora_key", { id }),

  deleteSporaKey: (id: string): Promise<void> =>
    invoke("delete_spora_key", { id }),
};

export const analyticsApi = {
  getUsageStats: (
    fromTs: number | null,
    toTs: number | null
  ): Promise<UsageStats> => invoke("get_usage_stats", { fromTs, toTs }),

  getProviderUsage: (
    fromTs: number | null,
    toTs: number | null
  ): Promise<ProviderUsage[]> =>
    invoke("get_provider_usage", { fromTs, toTs }),

  getModelUsage: (
    fromTs: number | null,
    toTs: number | null
  ): Promise<ModelUsage[]> => invoke("get_model_usage", { fromTs, toTs }),

  getKeyUsage: (
    fromTs: number | null,
    toTs: number | null
  ): Promise<KeyUsage[]> => invoke("get_key_usage", { fromTs, toTs }),

  getDailyUsage: (
    fromTs: number | null,
    toTs: number | null
  ): Promise<DailyUsage[]> => invoke("get_daily_usage", { fromTs, toTs }),

  getRequestLogs: (params: {
    limit: number;
    offset: number;
    sporaKeyId: string | null;
    provider: string | null;
    model: string | null;
  }): Promise<{ logs: RequestLog[]; total: number }> =>
    invoke("get_request_logs", { params }),
};

export const settingsApi = {
  getSettings: (): Promise<GatewaySettings> => invoke("get_settings"),

  updateSettings: (settings: GatewaySettings): Promise<void> =>
    invoke("update_settings", { settings }),

  exportLogs: (path: string): Promise<void> =>
    invoke("export_logs", { path }),

  clearLogs: (): Promise<void> => invoke("clear_logs"),

  getDbStats: (): Promise<{ sizeBytes: number; rowCount: number }> =>
    invoke("get_db_stats"),

  getGatewayStatus: (): Promise<{ running: boolean; port: number }> =>
    invoke("get_gateway_status"),

  startGateway: (): Promise<void> => invoke("start_gateway"),

  stopGateway: (): Promise<void> => invoke("stop_gateway"),
};

export const modelsApi = {
  listAvailableModels: (sporaKeyId: string): Promise<Model[]> =>
    invoke("list_available_models", { sporaKeyId }),

  syncModels: (): Promise<number> => invoke("sync_models"),

  getModelCount: (): Promise<number> => invoke("get_model_count"),

  resetModels: (): Promise<void> => invoke("reset_models"),
};

export const updaterApi = {
  checkForUpdates: (): Promise<string | null> => invoke("check_for_updates"),

  downloadUpdate: (): Promise<void> => invoke("download_update"),

  installAndRestart: (): Promise<void> => invoke("install_and_restart"),

  getCurrentVersion: (): Promise<string> => invoke("get_current_version"),
};
