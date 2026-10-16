import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import type { URLConfigService } from "./urlConfigService.js";
import { getPlatformSettings } from "../settings/settingsService.js";
import { getActiveApplication } from "./activeApplication.js";

/**
 * The URL of the application under test - the single source every stage
 * (Intelligence, Planner, Generator, commit-triggered and manual test runs)
 * uses, so they can never disagree about which app they're pointed at.
 *
 * Order: the active Application's own base URL (switching the active app
 * re-targets everything), then the legacy global testAppUrl setting, then
 * the URL profile, then APP_BASE_URL from .env. The active app comes first
 * because testAppUrl is one global value: left over from a previous app, it
 * would otherwise silently send the Planner and test runs to the wrong site.
 */
export function resolveTargetAppUrl(db: Db, config: Config, urlConfigService?: URLConfigService): string {
  const activeApp = getActiveApplication(db);
  if (activeApp?.appBaseUrl) return activeApp.appBaseUrl;
  const settings = getPlatformSettings(db, config);
  return settings.testAppUrl || urlConfigService?.getActiveConfig().appBaseUrl || config.appBaseUrl;
}
