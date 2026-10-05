import { existsSync } from "node:fs";
import { eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { applications, requirements } from "../db/schema.js";
import { getSetting, setSetting } from "../settings/settingsService.js";

const ACTIVE_APPLICATION_SETTING_KEY = "activeApplicationId";

export type Application = typeof applications.$inferSelect;

/** The Application currently driving the whole pipeline, or null if none has been created yet (fresh install, still running purely off .env). */
export function getActiveApplication(db: Db): Application | null {
  const activeId = getSetting<string | undefined>(db, ACTIVE_APPLICATION_SETTING_KEY, undefined);
  if (activeId) {
    const row = db.select().from(applications).where(eq(applications.id, activeId)).get();
    if (row) return row;
  }
  // No active id set (or it pointed at a since-deleted row) - fall back to
  // whichever application was created first, so the platform still has a
  // sensible single target instead of silently running unscoped.
  const rows = db.select().from(applications).all();
  return rows[0] ?? null;
}

export function setActiveApplication(db: Db, applicationId: string): Application {
  const row = db.select().from(applications).where(eq(applications.id, applicationId)).get();
  if (!row) throw new Error(`Application ${applicationId} not found`);
  setSetting(db, ACTIVE_APPLICATION_SETTING_KEY, applicationId);
  return row;
}

/**
 * Overlays the active Application's own fields onto a copy of the base
 * (.env-derived) Config - every agent entry point calls this once at the top
 * (`config = resolveAppConfig(db, config)`) so `config.backendSrcDir`,
 * `config.appBaseUrl`, `config.appLoginUsername`, etc. all refer to whichever
 * app is currently active, with zero signature changes needed downstream.
 * Every app-scoped field is taken unconditionally from the Application row
 * (never falling back to the base .env Config when blank) - the seeded
 * "Default" application has every field filled in explicitly at seed time
 * (see seedDefaultApplicationIfNone below), so it behaves exactly as before.
 * A genuinely different application that hasn't set e.g. source dirs must
 * resolve to "no source access", not silently inherit a PREVIOUS app's
 * directories/URL/credentials just because this one left them blank - that
 * would scan or log into the wrong app without any error. When no
 * Application exists at all (fresh install, pre-migration), this is a no-op.
 */
export function resolveAppConfig(db: Db, baseConfig: Config): Config {
  const app = getActiveApplication(db);
  if (!app) return baseConfig;

  return {
    ...baseConfig,
    appBaseUrl: app.appBaseUrl ?? "",
    apiBaseUrl: app.apiBaseUrl ?? "",
    backendSrcDir: app.backendSrcDir ?? "",
    frontendSrcDir: app.frontendSrcDir ?? "",
    frontendServerSrcDir: app.frontendServerSrcDir ?? "",
    appLoginUsername: app.loginUsername ?? undefined,
    appLoginPassword: app.loginPassword ?? undefined,
    appLoginUsernameLocator: app.loginUsernameLocator ?? undefined,
    appLoginPasswordLocator: app.loginPasswordLocator ?? undefined,
    appLoginSubmitLocator: app.loginSubmitLocator ?? undefined,
    applicationId: app.id,
    applicationName: app.name,
    applicationDescription: app.description ?? undefined,
  };
}

/**
 * Whether there's real source code to statically scan for the app a resolved
 * Config currently points at - replaces the old CallCenterUI-only
 * `isKnownAppUrl` hostname check. An app with neither directory configured
 * (the common case for a stack this platform has no scanner for) just skips
 * static analysis and relies on live Playwright exploration instead.
 */
export function hasSourceAccess(config: Config): boolean {
  return existsSync(config.backendSrcDir) || existsSync(config.frontendSrcDir);
}

/**
 * Seeds the very first Application from today's .env values, so upgrading
 * onto multi-app support doesn't lose or reset the app this platform was
 * already pointed at. No-ops once at least one Application exists.
 */
export function seedDefaultApplicationIfNone(db: Db, config: Config): void {
  const existing = db.select().from(applications).all();
  if (existing.length > 0) return;

  const row = db
    .insert(applications)
    .values({
      name: "Default",
      description: "Seeded automatically from .env on first run - rename or edit this with the real app's details.",
      appBaseUrl: config.appBaseUrl,
      apiBaseUrl: config.apiBaseUrl,
      backendSrcDir: config.backendSrcDir,
      frontendSrcDir: config.frontendSrcDir,
      frontendServerSrcDir: config.frontendServerSrcDir,
      loginUsername: config.appLoginUsername,
      loginPassword: config.appLoginPassword,
      loginUsernameLocator: config.appLoginUsernameLocator,
      loginPasswordLocator: config.appLoginPasswordLocator,
      loginSubmitLocator: config.appLoginSubmitLocator,
    })
    .returning({ id: applications.id })
    .get();
  setSetting(db, ACTIVE_APPLICATION_SETTING_KEY, row.id);

  // Every requirement created before this column existed belongs to the one
  // app this platform was already pointed at - attribute it, so nothing
  // this user already built looks orphaned once application scoping shows up.
  db.update(requirements).set({ applicationId: row.id }).where(isNull(requirements.applicationId)).run();
}
