import type { NetworkLogEntry } from "../schemas/scenarioResult.js";

// Matches @playwright/mcp's browser_network_requests text output, lines like:
//   "1. [GET] http://localhost:5000/ => [FAILED] net::ERR_CONNECTION_REFUSED"
//   "6. [GET] https://callcenter.fidar.io/logo.png => [404]"
const LINE_PATTERN = /^\s*\d+\.\s*\[(\w+)\]\s+(\S+)\s*=>\s*\[(FAILED|\d+)\](?:\s+(.*))?$/;

/**
 * Parses @playwright/mcp's browser_network_requests text dump into
 * structured entries. This is the tool's own ground-truth capture of what
 * actually happened over the wire - used as the authoritative networkLog
 * (overriding whatever the model self-reported in report_scenario_result,
 * which is narration and can be wrong or simply unfilled).
 */
export function parseNetworkRequestsText(text: string): NetworkLogEntry[] {
  const entries: NetworkLogEntry[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(LINE_PATTERN);
    if (!match) continue;
    const [, method, url, statusOrFailed, detail] = match;
    if (statusOrFailed === "FAILED") {
      entries.push({ method, url, ok: false, bodySnippet: detail?.trim() });
    } else {
      const status = Number(statusOrFailed);
      entries.push({ method, url, status, ok: status >= 200 && status < 400 });
    }
  }
  return entries;
}
