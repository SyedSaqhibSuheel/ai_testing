import path from "node:path";
import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolDef } from "../llm/types.js";

export interface ToolImageResult {
  mimeType: string;
  base64: string;
}

export interface ToolCallResult {
  text: string;
  images: ToolImageResult[];
  isError: boolean;
}

export interface PlaywrightMcpSession {
  tools: ToolDef[];
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
  close(): Promise<void>;
}

function resolveBin(rootDir: string): string {
  const bin = path.join(rootDir, "node_modules", ".bin", "playwright-mcp");
  if (!existsSync(bin)) {
    throw new Error(
      `Could not find the pinned @playwright/mcp binary at ${bin}. Run "npm install" in ai-test-framework first.`
    );
  }
  return bin;
}

/**
 * Spawns the locally pinned @playwright/mcp server over stdio (never
 * `npx @playwright/mcp@latest` - that would resolve a fresh, potentially
 * incompatible version on every run) and connects an MCP client to it.
 */
export async function startPlaywrightMcp(rootDir: string, headless: boolean): Promise<PlaywrightMcpSession> {
  const bin = resolveBin(rootDir);
  const args = ["--browser", "chromium", "--isolated"];
  if (headless) args.push("--headless");

  const transport = new StdioClientTransport({ command: bin, args, stderr: "pipe" });
  const client = new Client({ name: "ai-test-framework", version: "0.1.0" }, { capabilities: {} });

  await client.connect(transport);
  const { tools: mcpTools } = await client.listTools();

  const tools: ToolDef[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
  }));

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await client.close().catch(() => undefined);
  };

  process.once("exit", () => {
    // Best-effort synchronous-ish cleanup; the transport's underlying
    // child process is also killed by Node when the parent exits.
    void close();
  });

  return {
    tools,
    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args });
      const content = Array.isArray(result.content) ? result.content : [];
      const textParts: string[] = [];
      const images: ToolImageResult[] = [];

      for (const block of content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>) {
        if (block.type === "text") {
          textParts.push(block.text ?? "");
        } else if (block.type === "image" && block.data) {
          images.push({ mimeType: block.mimeType ?? "image/png", base64: block.data });
        } else {
          textParts.push(`[${block.type} content]`);
        }
      }

      return { text: textParts.join("\n"), images, isError: !!result.isError };
    },
    close,
  };
}
