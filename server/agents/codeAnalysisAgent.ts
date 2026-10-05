import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, type RequirementStatus } from "../db/schema.js";
import { buildContext } from "../../src/context/buildContext.js";
import { selectRelevantContext, type RelevantContext } from "../../src/context/selectRelevantContext.js";
import { walkFiles } from "../../src/context/fileWalk.js";
import { getProvider } from "../../src/llm/index.js";
import { IntelligenceAnalysisSchema, type IntelligenceAnalysis } from "../schemas/analysis.js";
import { buildCodeAnalysisSystemPrompt, buildCodeAnalysisUserPrompt, buildAutoRequirementText } from "./codeAnalysisPrompts.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { persistIntelligenceAnalysis } from "./persistIntelligenceAnalysis.js";
import { resolveAppConfig } from "../config/activeApplication.js";

export interface FrontendModule {
  file: string;
  componentName: string;
  relativePath: string;
  testIds: string[];
}

/**
 * Whether some OTHER real (non-demo) source file actually imports this
 * component - i.e. it's mounted somewhere reachable in the running app,
 * not just referenced from a components/examples/ storybook-style wrapper.
 * A component nobody imports outside of its own demo file can never be
 * reached by `page.goto(...)` in a real browser, so a generated E2E test
 * for it would fail every time regardless of the app's actual correctness.
 */
function isReachableFromApp(file: string, allSourceFiles: string[]): boolean {
  const sep = path.sep;
  const componentName = path.basename(file, path.extname(file));
  const importPattern = new RegExp(`[/'"]${componentName}["']`);
  return allSourceFiles.some((other) => {
    if (other === file) return false;
    if (other.includes(`${sep}components${sep}examples${sep}`)) return false;
    return importPattern.test(readFileSync(other, "utf-8"));
  });
}

/**
 * The real, product-specific screens/components of the active application -
 * deliberately narrower than "every .tsx under frontendSrcDir": excludes
 * components/ui (generic shadcn primitives with no product-specific
 * behavior), components/examples (storybook-style demo wrappers, not real
 * app screens), and any component that only that demo wrapper imports (i.e.
 * never actually mounted by a real page - see isReachableFromApp above).
 * This is the whole point of Code Analysis: it should only ever describe
 * the actual product, never a separate backend repo, generic UI kit, or
 * orphaned/demo-only components.
 */
function listFrontendModules(config: Config): FrontendModule[] {
  const sep = path.sep;
  const files = walkFiles(
    config.frontendSrcDir,
    (f) =>
      f.endsWith(".tsx") &&
      (f.includes(`${sep}components${sep}`) || f.includes(`${sep}pages${sep}`)) &&
      !f.includes(`${sep}components${sep}ui${sep}`) &&
      !f.includes(`${sep}components${sep}examples${sep}`)
  );

  const allSourceFiles = walkFiles(config.frontendSrcDir, (f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  const reachableFiles = files.filter((file) => isReachableFromApp(file, allSourceFiles));

  const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
  const testIdsByFile = new Map(context.frontend.components.map((c) => [c.file, c.testIds]));

  return reachableFiles
    .map((file) => ({
      file,
      componentName: path.basename(file, path.extname(file)),
      relativePath: path.relative(config.frontendSrcDir, file),
      testIds: testIdsByFile.get(file) ?? [],
    }))
    .sort((a, b) => a.componentName.localeCompare(b.componentName));
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

export interface CodeModuleSummary {
  name: string;
  relativePath: string;
  testIdCount: number;
  requirementId: string | null;
  requirementStatus: RequirementStatus | null;
}

/**
 * Lists every screen/component the scanner found, cross-referenced
 * against requirements already generated from it (source=code_analysis,
 * sourceModule=componentName) so the UI can show what's left to analyze.
 */
/**
 * code_analysis requirements, scoped to one Application - so switching the
 * active application doesn't show a completely different app's screens
 * under "already analyzed" or "added".
 */
function codeAnalysisRequirements(db: Db, applicationId: string | undefined) {
  return db
    .select()
    .from(requirements)
    .where(
      and(
        eq(requirements.source, "code_analysis"),
        eq(requirements.isDeleted, false),
        applicationId ? eq(requirements.applicationId, applicationId) : undefined
      )
    )
    .all();
}

export function listCodeModules(db: Db, config: Config): CodeModuleSummary[] {
  config = resolveAppConfig(db, config);
  const modules = listFrontendModules(config);
  const existing = codeAnalysisRequirements(db, config.applicationId);
  const bySourceModule = new Map(existing.map((r) => [r.sourceModule, r]));

  return modules.map((m) => {
    const match = bySourceModule.get(m.componentName);
    return {
      name: m.componentName,
      relativePath: m.relativePath,
      testIdCount: m.testIds.length,
      requirementId: match?.id ?? null,
      requirementStatus: match?.status ?? null,
    };
  });
}

export interface AddedCodeRequirementSummary {
  name: string;
  requirementId: string;
  requirementStatus: RequirementStatus;
}

/**
 * code_analysis requirements added by hand for behaviour that spans several
 * components (e.g. Theme: ThemeToggle + ThemeProvider + Header), so they have
 * no single scanned module to hang off. Kept separate from listCodeModules so
 * they never re-point an existing module row or skew its analyzed counts.
 */
export function listAddedCodeRequirements(db: Db, config: Config): AddedCodeRequirementSummary[] {
  config = resolveAppConfig(db, config);
  const moduleNames = new Set(listFrontendModules(config).map((m) => m.componentName));
  const latestByName = new Map<string, AddedCodeRequirementSummary>();
  const rows = codeAnalysisRequirements(db, config.applicationId);
  for (const r of rows) {
    if (!r.sourceModule || moduleNames.has(r.sourceModule)) continue;
    latestByName.set(r.sourceModule, { name: r.sourceModule, requirementId: r.id, requirementStatus: r.status });
  }
  return [...latestByName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function callCodeAnalysisLlm(config: Config, module: FrontendModule, source: string, backendContext: RelevantContext): Promise<IntelligenceAnalysis> {
  const provider = getProvider(config);
  const system = buildCodeAnalysisSystemPrompt(config.applicationName, config.applicationDescription);
  const user = buildCodeAnalysisUserPrompt(module, source, backendContext, config.applicationName);

  const attempt = async (extra?: string) => {
    const result = await provider.chat(
      [
        { role: "system", text: system },
        { role: "user", text: extra ? `${user}\n\n${extra}` : user },
      ],
      []
    );
    const parsed = IntelligenceAnalysisSchema.safeParse(extractJson(result.text ?? ""));
    if (!parsed.success) {
      throw new Error(`Code analysis output failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    }
    return parsed.data;
  };

  try {
    return await attempt();
  } catch (firstError) {
    return await attempt(
      `Your previous response was invalid: ${(firstError as Error).message}. Return ONLY the corrected JSON object.`
    );
  }
}

async function analyzeModule(db: Db, config: Config, module: FrontendModule): Promise<void> {
  const requirement = db
    .insert(requirements)
    .values({
      title: `Code Analysis: ${module.componentName}`,
      rawText: buildAutoRequirementText(module, config.applicationName),
      submittedBy: "code-analysis-agent",
      source: "code_analysis",
      sourceModule: module.componentName,
      status: "analyzing",
      applicationId: config.applicationId,
    })
    .returning()
    .get();

  const runId = startAgentRun(db, {
    agentType: "code_analysis",
    requirementId: requirement.id,
    input: { module: module.componentName, file: module.relativePath },
  });

  try {
    updateAgentRunTask(db, runId, `Reading source code: ${module.relativePath}`);
    const source = readFileSync(module.file, "utf-8");

    const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
    const queryText = [module.componentName, ...module.testIds].join(" ");
    // Backend endpoints are reference-only support here (this screen may call
    // a separate backend's APIs) - the analysis and the requirement it
    // produces are about the frontend screen itself, never the backend module.
    const backendContext = selectRelevantContext(queryText, context, { controllers: 3, dtos: 6, components: 0 });

    updateAgentRunTask(db, runId, `Analyzing: ${module.componentName}`);
    const analysis = await callCodeAnalysisLlm(config, module, source, backendContext);

    const { analysisId, scenarioCount } = persistIntelligenceAnalysis(db, config, requirement.id, runId, analysis);
    completeAgentRun(db, runId, { analysisId, scenarioCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failAgentRun(db, runId, message);
    db.update(requirements).set({ status: "failed", updatedAt: new Date() }).where(eq(requirements.id, requirement.id)).run();
    throw err;
  }
}

let batchRunning = false;
export function isCodeAnalysisBatchRunning(): boolean {
  return batchRunning;
}

/**
 * Analyzes every screen/component the scanner finds (the whole product,
 * one click), skipping ones that already have a
 * non-failed code_analysis requirement unless `force` is set. Runs modules
 * sequentially and keeps going past a single module's failure so one bad
 * LLM response doesn't block the rest - the UI shows per-module status via
 * listCodeModules/GET /requirements.
 */
export async function runCodeAnalysisBatch(db: Db, config: Config, opts: { force?: boolean } = {}): Promise<void> {
  if (batchRunning) throw new Error("A code analysis run is already in progress");
  batchRunning = true;
  config = resolveAppConfig(db, config);
  try {
    const modules = listFrontendModules(config);
    const existing = opts.force ? [] : codeAnalysisRequirements(db, config.applicationId);
    const alreadyAnalyzed = new Set(existing.filter((r) => r.status !== "failed").map((r) => r.sourceModule));

    for (const module of modules) {
      if (alreadyAnalyzed.has(module.componentName)) continue;
      try {
        await analyzeModule(db, config, module);
      } catch (err) {
        console.error(`Code analysis failed for module ${module.componentName}:`, err);
      }
    }
  } finally {
    batchRunning = false;
  }
}
