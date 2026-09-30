import { readFileSync } from "node:fs";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, type RequirementStatus } from "../db/schema.js";
import { buildContext } from "../../src/context/buildContext.js";
import { walkFiles } from "../../src/context/fileWalk.js";
import { getProvider } from "../../src/llm/index.js";
import { IntelligenceAnalysisSchema, type IntelligenceAnalysis } from "../schemas/analysis.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { persistIntelligenceAnalysis } from "./persistIntelligenceAnalysis.js";
import { isCodeAnalysisBatchRunning } from "./codeAnalysisAgent.js";

/**
 * Cross-cutting behaviours that no single screen/component owns (e.g. the
 * theme lives in ThemeProvider + ThemeToggle + Header + index.css), so the
 * per-module Code Analysis can't produce a requirement for them. Each one is
 * derived purely from the CallCenterUI source: the files whose code matches
 * `pattern`, read and handed to the LLM like a module is. The resulting
 * requirement is an ordinary code_analysis requirement (sourceModule = name),
 * so it flows through the same scenario → plan → generate → run pipeline.
 */
interface CodeFeature {
  name: string;
  title: string;
  focus: string;
  pattern: RegExp;
  includeCss?: boolean;
}

const FEATURES: CodeFeature[] = [
  {
    name: "Theme",
    title: "Theme (Dark/Light mode)",
    focus:
      "the dark/light theme: how the theme is stored and applied (provider, class on <html>, CSS variables, persistence), the toggle control that switches it, its initial/default value, and every place the UI reacts to it.",
    pattern: /useTheme|ThemeProvider|setTheme|toggleTheme|\btheme\b|\bdark\b|\blight\b|prefers-color-scheme/i,
    includeCss: true,
  },
  {
    name: "Action Buttons",
    title: "Action buttons",
    focus:
      "every interactive action a user can trigger (buttons, submit handlers, icon buttons, menu actions): what each one does, when it is enabled/disabled or hidden, confirmation steps, loading states, and what happens on success and on failure.",
    pattern: /onClick=|onSubmit=|<Button\b|<button\b|type="submit"/,
  },
  {
    name: "Status",
    title: "Status indicators",
    focus:
      "every status the UI displays (e.g. customer/verification/request status, last verified, approved/denied/pending/waiting): the possible values, how each is rendered (badge text, colour), how statuses change, status filters, and empty/unknown states.",
    pattern: /status|verif|<Badge\b|approved|denied|pending|waiting/i,
  },
  {
    name: "Navigation",
    title: "Navigation & user flows",
    focus:
      "how users move through the app: routes and route protection/redirects (e.g. to /login), tabs and view switching, links, sign-in/sign-out, and the end-to-end user flows these form (e.g. Login → Helpdesk → Customer Verification / Customer Database).",
    pattern: /<Route\b|useLocation|setLocation|useNavigate|navigate\(|<Link\b|<Tabs\b|TabsTrigger|setActiveTab|onValueChange|href=/,
  },
];

const MAX_FILES_PER_FEATURE = 7;
const MAX_CHARS_PER_FILE = 3000;
const MAX_TOTAL_CHARS = 16000;
const CONTEXT_LINES = 4;

interface FeatureFile {
  file: string;
  relativePath: string;
  matches: number;
}

/** Same scope as the module scan: the real app source, not the generic UI kit or demo wrappers. */
function listSourceFiles(config: Config, includeCss: boolean): string[] {
  const sep = path.sep;
  return walkFiles(
    config.frontendSrcDir,
    (f) =>
      (/\.(tsx|ts)$/.test(f) || (includeCss && f.endsWith(".css"))) &&
      !f.endsWith(".d.ts") &&
      !f.includes(`${sep}node_modules${sep}`) &&
      !f.includes(`${sep}components${sep}ui${sep}`) &&
      !f.includes(`${sep}components${sep}examples${sep}`)
  );
}

function featureFiles(config: Config, feature: CodeFeature): FeatureFile[] {
  const global = new RegExp(feature.pattern.source, feature.pattern.flags.includes("g") ? feature.pattern.flags : `${feature.pattern.flags}g`);
  return listSourceFiles(config, !!feature.includeCss)
    .map((file) => {
      let source = "";
      try {
        source = readFileSync(file, "utf-8");
      } catch {
        // unreadable file - just not part of this feature
      }
      return { file, relativePath: path.relative(config.frontendSrcDir, file), matches: source.match(global)?.length ?? 0 };
    })
    .filter((f) => f.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, MAX_FILES_PER_FEATURE);
}

/** The whole file if it's small, otherwise only the matching lines with a little surrounding context. */
function excerpt(source: string, pattern: RegExp): string {
  if (source.length <= MAX_CHARS_PER_FILE) return source;
  const lines = source.split("\n");
  const keep = new Set<number>();
  lines.forEach((line, i) => {
    if (pattern.test(line)) for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(lines.length - 1, i + CONTEXT_LINES); j++) keep.add(j);
  });
  let out = "";
  let last = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i !== last + 1) out += "  // ...\n";
    out += `${lines[i]}\n`;
    last = i;
    if (out.length > MAX_CHARS_PER_FILE) return `${out}  // ... (truncated)\n`;
  }
  return out;
}

function buildRequirementText(feature: CodeFeature, files: FeatureFile[]): string {
  return `Auto-generated from source code analysis of CallCenterUI's ${feature.title} across ${files.length} file(s): ${files.map((f) => f.relativePath).join(", ")}.`;
}

function buildSystemPrompt(): string {
  return [
    "MOCK_TASK: intelligence",
    "You are a senior QA analyst for the CallCenterUI application (a call center helpdesk React frontend). You are NOT given a human-written requirement. Instead you are given excerpts of the real source code for ONE cross-cutting behaviour of the app, taken from several screens/components. Read the code like a QA engineer and reverse-engineer what that behaviour does across the app, then propose tests for it.",
    "",
    "Only describe what the code evidences - never invent screens, fields, values or rules that aren't in it. Use the exact labels, status values, route paths and data-testid values from the code so a later grounding step can locate them. Keep draftSteps in plain English (no Playwright syntax).",
    "",
    "Output ONLY a single JSON object matching this shape (no markdown fences, no commentary):",
    JSON.stringify(
      {
        functionalRequirements: [{ description: "string" }],
        userRoles: ["string"],
        validationRules: ["string"],
        riskAreas: [{ area: "string", reason: "string" }],
        suggestedCoverage: ["string"],
        scenarios: [
          {
            title: "string",
            description: "string",
            scenarioType: "positive | negative | edge_case",
            priority: "low | medium | high | critical",
            riskLevel: "low | medium | high",
            preconditions: ["string"],
            draftSteps: ["string"],
            expectedResult: "string",
            aiConfidence: 0.0,
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");
}

function buildUserPrompt(config: Config, feature: CodeFeature, files: FeatureFile[]): string {
  const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
  const testIdsByFile = new Map(context.frontend.components.map((c) => [c.file, c.testIds]));

  let budget = MAX_TOTAL_CHARS;
  const sections: string[] = [];
  for (const f of files) {
    if (budget <= 0) break;
    const body = excerpt(readFileSync(f.file, "utf-8"), feature.pattern).slice(0, budget);
    budget -= body.length;
    const testIds = testIdsByFile.get(f.file) ?? [];
    sections.push(
      [`### ${f.relativePath}${testIds.length ? ` (data-testid: ${testIds.join(", ")})` : ""}`, "```" + (f.file.endsWith(".css") ? "css" : "tsx"), body, "```"].join("\n")
    );
  }

  return [
    `REQUIREMENT: ${buildRequirementText(feature, files)}`,
    "",
    `BEHAVIOUR TO ANALYZE: ${feature.title} - ${feature.focus}`,
    "",
    ...(feature.name === "Navigation"
      ? ["## Routes found by the static route scan", context.frontend.routes.map((r) => `- ${r.path}${r.component ? ` → ${r.component}` : ""}`).join("\n") || "(none)", ""]
      : []),
    "## Source code (only the parts relevant to this behaviour)",
    sections.join("\n\n"),
  ].join("\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

/**
 * Models (Gemini especially) often label a scenario "edge case", "Negative
 * Test", "happy path" or similar instead of the exact enum value. One such
 * label used to fail the whole analysis, so map the obvious variants onto the
 * allowed values - and fall back to a neutral value for anything else, since
 * every scenario is a draft a human reviews anyway.
 */
export function normalizeScenarioLabels(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { scenarios?: unknown }).scenarios)) return raw;
  const key = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().replace(/[\s-]+/g, "_") : "");
  const scenarioType = (v: unknown) => {
    const k = key(v);
    if (["positive", "negative", "edge_case"].includes(k)) return k;
    if (/edge|boundary|corner|extreme/.test(k)) return "edge_case";
    if (/neg|error|fail|invalid|unauthori[sz]ed|reject/.test(k)) return "negative";
    return "positive";
  };
  const priority = (v: unknown) => {
    const k = key(v);
    if (["low", "medium", "high", "critical"].includes(k)) return k;
    if (/crit|blocker|p0|urgent/.test(k)) return "critical";
    if (/high|p1|major/.test(k)) return "high";
    if (/low|p3|minor|trivial/.test(k)) return "low";
    return "medium";
  };
  const riskLevel = (v: unknown) => {
    const k = key(v);
    if (["low", "medium", "high"].includes(k)) return k;
    if (/crit|high|severe/.test(k)) return "high";
    if (/low|minor/.test(k)) return "low";
    return "medium";
  };
  const obj = raw as { scenarios: Array<Record<string, unknown>> };
  return {
    ...obj,
    scenarios: obj.scenarios.map((s) =>
      s && typeof s === "object"
        ? { ...s, scenarioType: scenarioType(s.scenarioType), priority: priority(s.priority), riskLevel: riskLevel(s.riskLevel) }
        : s
    ),
  };
}

async function callLlm(config: Config, user: string): Promise<IntelligenceAnalysis> {
  const provider = getProvider(config);
  const system = buildSystemPrompt();
  const attempt = async (extra?: string) => {
    const result = await provider.chat(
      [
        { role: "system", text: system },
        { role: "user", text: extra ? `${user}\n\n${extra}` : user },
      ],
      []
    );
    const parsed = IntelligenceAnalysisSchema.safeParse(normalizeScenarioLabels(extractJson(result.text ?? "")));
    if (!parsed.success) throw new Error(`Code feature analysis output failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    return parsed.data;
  };
  try {
    return await attempt();
  } catch (firstError) {
    return await attempt(
      `Your previous response was invalid: ${(firstError as Error).message}. Use exactly these values: scenarioType "positive" | "negative" | "edge_case"; priority "low" | "medium" | "high" | "critical"; riskLevel "low" | "medium" | "high". Return ONLY the corrected JSON object.`
    );
  }
}

async function analyzeFeature(db: Db, config: Config, feature: CodeFeature, files: FeatureFile[]): Promise<void> {
  const requirement = db
    .insert(requirements)
    .values({
      title: `Code Analysis: ${feature.title}`,
      rawText: buildRequirementText(feature, files),
      submittedBy: "code-analysis-agent",
      source: "code_analysis",
      sourceModule: feature.name,
      status: "analyzing",
    })
    .returning()
    .get();

  const runId = startAgentRun(db, {
    agentType: "code_analysis",
    requirementId: requirement.id,
    input: { feature: feature.name, files: files.map((f) => f.relativePath) },
  });
  try {
    updateAgentRunTask(db, runId, `Analyzing: ${feature.title}`);
    const analysis = await callLlm(config, buildUserPrompt(config, feature, files));
    const { analysisId, scenarioCount } = persistIntelligenceAnalysis(db, config, requirement.id, runId, analysis);
    completeAgentRun(db, runId, { analysisId, scenarioCount });
  } catch (err) {
    failAgentRun(db, runId, err instanceof Error ? err.message : String(err));
    db.update(requirements).set({ status: "failed", updatedAt: new Date() }).where(eq(requirements.id, requirement.id)).run();
    throw err;
  }
}

function latestFeatureRequirements(db: Db) {
  const names = new Set(FEATURES.map((f) => f.name));
  const byName = new Map<string, typeof requirements.$inferSelect>();
  const rows = db
    .select()
    .from(requirements)
    .where(and(eq(requirements.source, "code_analysis"), eq(requirements.isDeleted, false)))
    .orderBy(desc(requirements.createdAt))
    .all();
  for (const r of rows) {
    if (r.sourceModule && names.has(r.sourceModule) && !byName.has(r.sourceModule)) byName.set(r.sourceModule, r);
  }
  return byName;
}

export interface CodeFeatureSummary {
  name: string;
  title: string;
  files: string[];
  requirementId: string | null;
  requirementStatus: RequirementStatus | null;
}

export function listCodeFeatures(db: Db, config: Config): CodeFeatureSummary[] {
  const existing = latestFeatureRequirements(db);
  return FEATURES.map((feature) => {
    const match = existing.get(feature.name);
    return {
      name: feature.name,
      title: feature.title,
      files: featureFiles(config, feature).map((f) => f.relativePath),
      requirementId: match?.id ?? null,
      requirementStatus: match?.status ?? null,
    };
  });
}

let featureBatchRunning = false;
export function isCodeFeatureBatchRunning(): boolean {
  return featureBatchRunning;
}

/**
 * Analyzes every cross-cutting feature that has matching source and no
 * non-failed requirement yet (all of them with `force`). Waits for a running
 * module batch to finish first so the two never compete for the LLM's rate
 * limit, and keeps going past a single feature's failure.
 */
export async function runCodeFeatureBatch(db: Db, config: Config, opts: { force?: boolean } = {}): Promise<void> {
  if (featureBatchRunning) throw new Error("A code feature analysis run is already in progress");
  featureBatchRunning = true;
  try {
    while (isCodeAnalysisBatchRunning()) await new Promise((r) => setTimeout(r, 3000));
    const existing = latestFeatureRequirements(db);
    for (const feature of FEATURES) {
      const current = existing.get(feature.name);
      if (!opts.force && current && current.status !== "failed") continue;
      const files = featureFiles(config, feature);
      if (files.length === 0) continue;
      try {
        await analyzeFeature(db, config, feature, files);
      } catch (err) {
        console.error(`Code feature analysis failed for ${feature.name}:`, err);
      }
    }
  } finally {
    featureBatchRunning = false;
  }
}
