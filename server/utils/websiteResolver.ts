/**
 * Best-effort "which website was this test run against" resolution.
 *
 * Runs created after the `test_runs.app_url` column was added always have it
 * set (see server/execution/runTests.ts). Runs from before that migration
 * don't - for those we fall back to the URL hardcoded into the generated
 * spec's `page.goto(...)` calls, which the Generator agent always writes
 * literally (see server/agents/generatorAgent.ts / actual generated files).
 */

const URL_PATTERN = /https?:\/\/[^\s'"`)]+/;

export function extractFirstUrl(code: string): string | null {
  const match = code.match(URL_PATTERN);
  return match ? match[0] : null;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function resolveRunWebsite(appUrl: string | null, testFileCode: string): string {
  const fromAppUrl = appUrl ? hostnameOf(appUrl) : null;
  if (fromAppUrl) return fromAppUrl;

  const fallbackUrl = extractFirstUrl(testFileCode);
  const fromCode = fallbackUrl ? hostnameOf(fallbackUrl) : null;
  if (fromCode) return fromCode;

  return "Unknown";
}
