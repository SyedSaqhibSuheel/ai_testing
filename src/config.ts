import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname at runtime is dist/src/ (tsconfig rootDir is the ai-test-framework
// root so both src/ and server/ compile under dist/ preserving their subpath).
const ROOT_DIR = path.resolve(__dirname, "../..");

function loadDotEnv(): void {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf-8");
  const env = process.env as unknown as Record<string, string | undefined>;
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

loadDotEnv();

const ConfigSchema = z.object({
  llmProvider: z.enum(["anthropic", "openai", "gemini", "mock"]),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string(),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string(),
  geminiApiKey: z.string().optional(),
  geminiModel: z.string(),
  backendSrcDir: z.string(),
  frontendSrcDir: z.string(),
  frontendServerSrcDir: z.string(),
  appBaseUrl: z.url(),
  apiBaseUrl: z.url(),
  appAuthToken: z.string().optional(),
  appLoginUsername: z.string().optional(),
  appLoginPassword: z.string().optional(),
  mcpHeadless: z.boolean(),
  dashboardPort: z.number().int().positive(),
  rootDir: z.string(),
  runsDir: z.string(),
  cacheDir: z.string(),
  // AI Testing Platform (server/ + web/)
  serverPort: z.number().int().positive(),
  dbPath: z.string(),
  managedRepoDir: z.string(),
  managedRepoBranch: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

export function loadConfig(): Config {
  const env = process.env as unknown as Record<string, string | undefined>;
  const raw = {
    llmProvider: (env.LLM_PROVIDER ?? "mock") as "anthropic" | "openai" | "gemini" | "mock",
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    openaiApiKey: env.OPENAI_API_KEY || undefined,
    openaiModel: env.OPENAI_MODEL ?? "gpt-4o",
    geminiApiKey: env.GEMINI_API_KEY || undefined,
    geminiModel: env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
    backendSrcDir: path.resolve(ROOT_DIR, env.BACKEND_SRC_DIR ?? "../fidar-server/src/main/java"),
    frontendSrcDir: path.resolve(ROOT_DIR, env.FRONTEND_SRC_DIR ?? "../CallCenterUI/client/src"),
    frontendServerSrcDir: path.resolve(ROOT_DIR, env.FRONTEND_SERVER_SRC_DIR ?? "../CallCenterUI/server"),
    appBaseUrl: env.APP_BASE_URL ?? "http://localhost:5000",
    apiBaseUrl: env.API_BASE_URL ?? "http://localhost:8084/fidar/sdk/api",
    appAuthToken: env.APP_AUTH_TOKEN || undefined,
    appLoginUsername: env.APP_LOGIN_USERNAME || undefined,
    appLoginPassword: env.APP_LOGIN_PASSWORD || undefined,
    mcpHeadless: toBool(env.MCP_HEADLESS, true),
    dashboardPort: Number(env.DASHBOARD_PORT ?? "4700"),
    rootDir: ROOT_DIR,
    runsDir: path.join(ROOT_DIR, "runs"),
    cacheDir: path.join(ROOT_DIR, ".cache"),
    serverPort: Number(env.SERVER_PORT ?? "4701"),
    dbPath: path.resolve(ROOT_DIR, env.DB_PATH ?? "data/platform.db"),
    managedRepoDir: path.resolve(ROOT_DIR, env.MANAGED_REPO_DIR ?? "../generated-tests-repo"),
    managedRepoBranch: env.MANAGED_REPO_BRANCH ?? "main",
  };

  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Invalid configuration:", parsed.error.issues);
    throw new Error("Invalid configuration - check your .env file against .env.example");
  }

  if (parsed.data.llmProvider === "anthropic" && !parsed.data.anthropicApiKey) {
    throw new Error("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY to be set in .env");
  }
  if (parsed.data.llmProvider === "openai" && !parsed.data.openaiApiKey) {
    throw new Error("LLM_PROVIDER=openai requires OPENAI_API_KEY to be set in .env");
  }
  if (parsed.data.llmProvider === "gemini" && !parsed.data.geminiApiKey) {
    throw new Error("LLM_PROVIDER=gemini requires GEMINI_API_KEY to be set in .env");
  }

  return parsed.data;
}
