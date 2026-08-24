import type { Config } from "./config.js";
import { buildContext } from "./context/buildContext.js";
import { selectRelevantContext } from "./context/selectRelevantContext.js";
import { getProvider } from "./llm/index.js";
import { planScenarios } from "./planner/planScenarios.js";
import { runPlan } from "./executor/runPlan.js";
import { newRunId, saveRun } from "./store/runStore.js";
import type { TestPlan } from "./schemas/testPlan.js";

export interface PlanAndRunResult {
  runId: string;
  runDir: string;
  plan: TestPlan;
}

/**
 * The shared "requirement in, pass/fail out" pipeline used by both the CLI
 * (`all` command) and the dashboard's "New Test Run" form, so there's one
 * place that does plan -> execute -> classify -> store.
 */
export async function planAndRunOnce(
  config: Config,
  requirement: string,
  appBaseUrlOverride?: string,
  presetRunId?: string
): Promise<PlanAndRunResult> {
  const effectiveConfig: Config = appBaseUrlOverride ? { ...config, appBaseUrl: appBaseUrlOverride } : config;

  const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
  const relevant = selectRelevantContext(requirement, context);
  const provider = getProvider(config);

  const plan = await planScenarios(provider, requirement, relevant);
  const planRun = await runPlan(provider, effectiveConfig, plan, context, relevant);

  const runId = presetRunId ?? newRunId();
  const runDir = saveRun(config.runsDir, runId, plan, planRun);

  return { runId, runDir, plan };
}
