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

export interface FrontendModule {
  file: string;
  componentName: string;
  relativePath: string;
  testIds: string[];
}

/**
 * The real, product-specific screens/components of the CallCenterUI app -
 * deliberately narrower than "every .tsx under frontendSrcDir": excludes
 * components/ui (generic shadcn primitives with no call-center-specific
 * behavior) and components/examples (storybook-style demo wrappers, not
 * real app screens). This is the whole point of Code Analysis: it should
 * only ever describe the actual call center product, never the shared
 * fidar-server backend or generic UI kit.
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

  const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
  const testIdsByFile = new Map(context.frontend.components.map((c) => [c.file, c.testIds]));

  return files
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
 * Lists every CallCenterUI screen/component the scanner found, cross-referenced
 * against requirements already generated from it (source=code_analysis,
 * sourceModule=componentName) so the UI can show what's left to analyze.
 */
export function listCodeModules(db: Db, config: Config): CodeModuleSummary[] {
  const modules = listFrontendModules(config);
  const existing = db
    .select()
    .from(requirements)
    .where(and(eq(requirements.source, "code_analysis"), eq(requirements.isDeleted, false)))
    .all();
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

async function callCodeAnalysisLlm(config: Config, module: FrontendModule, source: string, backendContext: RelevantContext): Promise<IntelligenceAnalysis> {
  const provider = getProvider(config);
  const system = buildCodeAnalysisSystemPrompt();
  const user = buildCodeAnalysisUserPrompt(module, source, backendContext);

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
      rawText: buildAutoRequirementText(module),
      submittedBy: "code-analysis-agent",
      source: "code_analysis",
      sourceModule: module.componentName,
      status: "analyzing",
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
    // fidar-server APIs) - the analysis and the requirement it produces are
    // about the CallCenterUI screen itself, never about the backend module.
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
 * Analyzes every CallCenterUI screen/component the scanner finds (the whole
 * call center product, one click), skipping ones that already have a
 * non-failed code_analysis requirement unless `force` is set. Runs modules
 * sequentially and keeps going past a single module's failure so one bad
 * LLM response doesn't block the rest - the UI shows per-module status via
 * listCodeModules/GET /requirements.
 */
export async function runCodeAnalysisBatch(db: Db, config: Config, opts: { force?: boolean } = {}): Promise<void> {
  if (batchRunning) throw new Error("A code analysis run is already in progress");
  batchRunning = true;
  try {
    const modules = listFrontendModules(config);
    const existing = opts.force
      ? []
      : db.select().from(requirements).where(and(eq(requirements.source, "code_analysis"), eq(requirements.isDeleted, false))).all();
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
