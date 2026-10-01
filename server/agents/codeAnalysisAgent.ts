import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, scenarios, type RequirementStatus } from "../db/schema.js";
import { buildContext } from "../../src/context/buildContext.js";
import { selectRelevantContext, type RelevantContext } from "../../src/context/selectRelevantContext.js";
import { walkFiles } from "../../src/context/fileWalk.js";
import { getProvider } from "../../src/llm/index.js";
import { IntelligenceAnalysisSchema, type IntelligenceAnalysis } from "../schemas/analysis.js";
import { buildCodeAnalysisSystemPrompt, buildCodeAnalysisUserPrompt, buildAutoRequirementText } from "./codeAnalysisPrompts.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { persistIntelligenceAnalysis } from "./persistIntelligenceAnalysis.js";
import { runPlannerAgent } from "./plannerAgent.js";
import { runGeneratorAgent } from "./generatorAgent.js";
import { updatePlatformSettings } from "../settings/settingsService.js";
import { approveScenario } from "../scenarios/scenarioTransitions.js";

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
export async function listCodeModules(db: Db, config: Config): Promise<CodeModuleSummary[]> {
  const modules = listFrontendModules(config);
  const existing = await db
    .select()
    .from(requirements)
    .where(and(eq(requirements.source, "code_analysis"), eq(requirements.isDeleted, false)));
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
export async function listAddedCodeRequirements(db: Db, config: Config): Promise<AddedCodeRequirementSummary[]> {
  const moduleNames = new Set(listFrontendModules(config).map((m) => m.componentName));
  const latestByName = new Map<string, AddedCodeRequirementSummary>();
  const rows = await db
    .select()
    .from(requirements)
    .where(and(eq(requirements.source, "code_analysis"), eq(requirements.isDeleted, false)));
  for (const r of rows) {
    if (!r.sourceModule || moduleNames.has(r.sourceModule)) continue;
    latestByName.set(r.sourceModule, { name: r.sourceModule, requirementId: r.id, requirementStatus: r.status });
  }
  return [...latestByName.values()].sort((a, b) => a.name.localeCompare(b.name));
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

async function analyzeModule(db: Db, config: Config, module: FrontendModule): Promise<string> {
  const [requirement] = await db
    .insert(requirements)
    .values({
      title: `Code Analysis: ${module.componentName}`,
      rawText: buildAutoRequirementText(module),
      submittedBy: "code-analysis-agent",
      source: "code_analysis",
      sourceModule: module.componentName,
      status: "analyzing",
    })
    .returning();

  const runId = await startAgentRun(db, {
    agentType: "code_analysis",
    requirementId: requirement.id,
    input: { module: module.componentName, file: module.relativePath },
  });

  try {
    await updateAgentRunTask(db, runId, `Reading source code: ${module.relativePath}`);
    const source = readFileSync(module.file, "utf-8");

    const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
    const queryText = [module.componentName, ...module.testIds].join(" ");
    // Backend endpoints are reference-only support here (this screen may call
    // fidar-server APIs) - the analysis and the requirement it produces are
    // about the CallCenterUI screen itself, never about the backend module.
    const backendContext = selectRelevantContext(queryText, context, { controllers: 3, dtos: 6, components: 0 });

    await updateAgentRunTask(db, runId, `Analyzing: ${module.componentName}`);
    const analysis = await callCodeAnalysisLlm(config, module, source, backendContext);

    const { analysisId, scenarioCount } = await persistIntelligenceAnalysis(db, config, requirement.id, runId, analysis);
    await completeAgentRun(db, runId, { analysisId, scenarioCount });
    return requirement.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAgentRun(db, runId, message);
    await db.update(requirements).set({ status: "failed", updatedAt: new Date() }).where(eq(requirements.id, requirement.id));
    throw err;
  }
}

let batchRunning = false;
export function isCodeAnalysisBatchRunning(): boolean {
  return batchRunning;
}

/**
 * Pushes one requirement as far through Planner -> Generator as its current
 * scenario statuses allow, auto-approving any gate the scenarios are stuck
 * waiting on (G1/G2) along the way. Exists because a module may already have
 * a code_analysis requirement sitting mid-pipeline from an earlier
 * non-autoTest run (e.g. analyzed back when Approval Mode was Manual, never
 * approved) - autoTest should finish those off too, not just brand-new
 * modules. Safe to call on a requirement that's already fully advanced: each
 * step is a no-op if there's nothing in the matching status.
 */
async function advanceRequirementAutomatically(db: Db, config: Config, requirementId: string): Promise<void> {
  const stuckAtG1 = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.status, "ai_proposed")));
  for (const s of stuckAtG1) await approveScenario(db, s.id, "system", "system_auto");

  const readyToPlan = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.status, "approved")));
  if (readyToPlan.length > 0) {
    await runPlannerAgent(db, config, requirementId);
  }

  const stuckAtG2 = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.status, "grounded_pending_review")));
  for (const s of stuckAtG2) await approveScenario(db, s.id, "system", "system_auto");

  const readyToGenerate = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.status, "approved_for_generation")));
  if (readyToGenerate.length > 0) {
    await runGeneratorAgent(db, config, requirementId);
  }
}

/**
 * Analyzes every CallCenterUI screen/component the scanner finds (the whole
 * call center product, one click), skipping ones that already have a
 * non-failed code_analysis requirement unless `force` is set. Runs modules
 * sequentially and keeps going past a single module's failure so one bad
 * LLM response doesn't block the rest - the UI shows per-module status via
 * listCodeModules/GET /requirements.
 *
 * `autoTest`, when set, also pushes each module through Planner -> Generator
 * (which itself auto-commits and auto-runs under G3/G4), including modules
 * that already have a requirement sitting mid-pipeline from an earlier
 * non-autoTest run - see `advanceRequirementAutomatically`. This only works
 * if scenario intent (G1) and the grounded plan (G2) also auto-approve, so
 * this forces approvalMode to fully_automatic for the duration of the run
 * (it's a platform-wide setting, not per-run, so it stays that way
 * afterwards too - the human running this button is opting into that).
 * Modules run one at a time on purpose: the Planner spins up a real
 * Playwright browser session per requirement, and running several of those
 * concurrently against the same app/login would race against each other.
 */
export async function runCodeAnalysisBatch(db: Db, config: Config, opts: { force?: boolean; autoTest?: boolean } = {}): Promise<void> {
  if (batchRunning) throw new Error("A code analysis run is already in progress");
  batchRunning = true;
  try {
    if (opts.autoTest) {
      await updatePlatformSettings(db, { approvalMode: "fully_automatic" });
    }

    const modules = listFrontendModules(config);
    const existing = opts.force
      ? []
      : await db.select().from(requirements).where(and(eq(requirements.source, "code_analysis"), eq(requirements.isDeleted, false)));
    const existingByModule = new Map(existing.map((r) => [r.sourceModule, r]));

    for (const module of modules) {
      const existingReq = existingByModule.get(module.componentName);
      if (existingReq?.status === "committed") continue; // fully done already, nothing to do

      try {
        const requirementId = existingReq && existingReq.status !== "failed" ? existingReq.id : await analyzeModule(db, config, module);
        if (opts.autoTest) {
          try {
            await advanceRequirementAutomatically(db, config, requirementId);
          } catch (err) {
            console.error(`Auto-test pipeline (plan/generate) failed for module ${module.componentName}:`, err);
          }
        }
      } catch (err) {
        console.error(`Code analysis failed for module ${module.componentName}:`, err);
      }
    }
  } finally {
    batchRunning = false;
  }
}
