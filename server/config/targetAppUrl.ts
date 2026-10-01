import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import type { URLConfigService } from "./urlConfigService.js";
import { getPlatformSettings } from "../settings/settingsService.js";

/**
 * The application under test, resolved the same way the Planner and test
 * runs do: the testAppUrl setting (Settings page) first, then the active URL
 * profile, then APP_BASE_URL from .env. Never a URL written into the code -
 * pointing the platform at another app is purely a configuration change.
 */
export function resolveTargetAppUrl(db: Db, config: Config, urlConfigService?: URLConfigService): string {
  const settings = getPlatformSettings(db, config);
  return settings.testAppUrl || urlConfigService?.getActiveConfig().appBaseUrl || config.appBaseUrl;
}
