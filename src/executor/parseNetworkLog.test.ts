import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNetworkRequestsText } from "./parseNetworkLog.js";

test("parseNetworkRequestsText parses success and failure lines from real @playwright/mcp output", () => {
  const raw = [
    "### Result",
    "1. [GET] http://localhost:5000/ => [FAILED] net::ERR_CONNECTION_REFUSED",
    "6. [GET] https://callcenter.fidar.io/logo.png => [404]",
    "12. [GET] https://callcenter.fidar.io/api/customers => [200]",
    "Note: 8 static requests omitted",
  ].join("\n");

  const entries = parseNetworkRequestsText(raw);

  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { method: "GET", url: "http://localhost:5000/", ok: false, bodySnippet: "net::ERR_CONNECTION_REFUSED" });
  assert.deepEqual(entries[1], { method: "GET", url: "https://callcenter.fidar.io/logo.png", status: 404, ok: false });
  assert.deepEqual(entries[2], { method: "GET", url: "https://callcenter.fidar.io/api/customers", status: 200, ok: true });
});
