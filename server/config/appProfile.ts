import type { Config } from "../../src/config.js";

/**
 * True when `appBaseUrl` is the platform's configured CallCenterUI app
 * (same host as `config.appBaseUrl`) - the only app this platform has local
 * source code for. Any other host (e.g. a URL profile switched to an
 * unrelated site) has no static source to ground against, so callers must
 * fall back to live-discovered data (Playwright exploration) only, instead
 * of mixing in CallCenterUI's static testids/routes/login credentials.
 */
export function isKnownAppUrl(appBaseUrl: string, config: Config): boolean {
  try {
    return new URL(appBaseUrl).hostname === new URL(config.appBaseUrl).hostname;
  } catch {
    return false;
  }
}
