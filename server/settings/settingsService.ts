import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { settings, type ApprovalMode } from "../db/schema.js";
import type { Config } from "../../src/config.js";

// Non-secret operational knobs, overridable at runtime from the dashboard.
// Defaults come from the current .env-derived Config; secrets (API keys)
// never pass through this service or get stored in the DB.
export interface PlatformSettings {
  approvalMode: ApprovalMode;
  llmProvider: Config["llmProvider"];
  maxRetries: number;
  agentTimeoutMs: number;
  managedRepoDir: string;
  managedRepoBranch: string;
}

const SETTINGS_DEFAULTS = {
  approvalMode: "manual" as ApprovalMode,
  maxRetries: 2,
  agentTimeoutMs: 120_000,
};

export function getSetting<T>(db: Db, key: string, fallback: T): T {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value !== null && row?.value !== undefined ? (row.value as T) : fallback;
}

export function setSetting(db: Db, key: string, value: unknown): void {
  db.insert(settings)
    .values({ key, value: value as never, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as never, updatedAt: new Date() } })
    .run();
}

export function getPlatformSettings(db: Db, config: Config): PlatformSettings {
  return {
    approvalMode: getSetting(db, "approvalMode", SETTINGS_DEFAULTS.approvalMode),
    llmProvider: getSetting(db, "llmProvider", config.llmProvider),
    maxRetries: getSetting(db, "maxRetries", SETTINGS_DEFAULTS.maxRetries),
    agentTimeoutMs: getSetting(db, "agentTimeoutMs", SETTINGS_DEFAULTS.agentTimeoutMs),
    managedRepoDir: getSetting(db, "managedRepoDir", config.managedRepoDir),
    managedRepoBranch: getSetting(db, "managedRepoBranch", config.managedRepoBranch),
  };
}

/** What the Settings page is allowed to see - presence booleans for secrets, never values. */
export interface MaskedSettings extends PlatformSettings {
  secretsPresent: {
    anthropicApiKey: boolean;
    openaiApiKey: boolean;
    geminiApiKey: boolean;
  };
  appBaseUrl: string;
  apiBaseUrl: string;
}

export function getMaskedSettings(db: Db, config: Config): MaskedSettings {
  return {
    ...getPlatformSettings(db, config),
    secretsPresent: {
      anthropicApiKey: !!config.anthropicApiKey,
      openaiApiKey: !!config.openaiApiKey,
      geminiApiKey: !!config.geminiApiKey,
    },
    appBaseUrl: config.appBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
  };
}

const UPDATABLE_KEYS = new Set<keyof PlatformSettings>([
  "approvalMode",
  "llmProvider",
  "maxRetries",
  "agentTimeoutMs",
  "managedRepoDir",
  "managedRepoBranch",
]);

export function updatePlatformSettings(db: Db, patch: Partial<PlatformSettings>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (UPDATABLE_KEYS.has(key as keyof PlatformSettings) && value !== undefined) {
      setSetting(db, key, value);
    }
  }
}
