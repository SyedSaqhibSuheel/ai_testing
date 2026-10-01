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
  appBaseUrl: string;
  apiBaseUrl: string;
  testAppUrl?: string; // Flexible test app URL, set from Settings panel
}

const SETTINGS_DEFAULTS = {
  approvalMode: "manual" as ApprovalMode,
  maxRetries: 2,
  agentTimeoutMs: 120_000,
};

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value !== null && row?.value !== undefined ? (row.value as T) : fallback;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as never, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as never, updatedAt: new Date() } });
}

export async function getPlatformSettings(db: Db, config: Config): Promise<PlatformSettings> {
  return {
    approvalMode: await getSetting(db, "approvalMode", SETTINGS_DEFAULTS.approvalMode),
    llmProvider: await getSetting(db, "llmProvider", config.llmProvider),
    maxRetries: await getSetting(db, "maxRetries", SETTINGS_DEFAULTS.maxRetries),
    agentTimeoutMs: await getSetting(db, "agentTimeoutMs", SETTINGS_DEFAULTS.agentTimeoutMs),
    managedRepoDir: await getSetting(db, "managedRepoDir", config.managedRepoDir),
    managedRepoBranch: await getSetting(db, "managedRepoBranch", config.managedRepoBranch),
    appBaseUrl: config.appBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
    testAppUrl: await getSetting<string | undefined>(db, "testAppUrl", undefined),
  };
}

/** What the Settings page is allowed to see - presence booleans for secrets, never values. */
export interface MaskedSettings extends PlatformSettings {
  secretsPresent: {
    anthropicApiKey: boolean;
    openaiApiKey: boolean;
    geminiApiKey: boolean;
  };
}

export async function getMaskedSettings(db: Db, config: Config): Promise<MaskedSettings> {
  return {
    ...(await getPlatformSettings(db, config)),
    secretsPresent: {
      anthropicApiKey: !!config.anthropicApiKey,
      openaiApiKey: !!config.openaiApiKey,
      geminiApiKey: !!config.geminiApiKey,
    },
  };
}

const UPDATABLE_KEYS = new Set<keyof PlatformSettings>([
  "approvalMode",
  "llmProvider",
  "maxRetries",
  "agentTimeoutMs",
  "managedRepoDir",
  "managedRepoBranch",
  "testAppUrl",
]);

export async function updatePlatformSettings(db: Db, patch: Partial<PlatformSettings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    if (UPDATABLE_KEYS.has(key as keyof PlatformSettings) && value !== undefined) {
      await setSetting(db, key, value);
    }
  }
}
