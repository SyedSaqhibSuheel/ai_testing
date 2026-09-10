import { Command } from "commander";
import { loadConfig } from "./config.js";
import { buildContext } from "./context/buildContext.js";
import { selectRelevantContext } from "./context/selectRelevantContext.js";
import { getProvider } from "./llm/index.js";
import { planScenarios } from "./planner/planScenarios.js";
import { validatePlan } from "./planner/validatePlan.js";
import { runPlan } from "./executor/runPlan.js";
import { newRunId, saveRun, listRuns, loadRunDetail } from "./store/runStore.js";
import { startDashboard } from "./dashboard/server.js";
import { planAndRunOnce } from "./orchestrate.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { TestPlanSchema } from "./schemas/testPlan.js";

function friendlyErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  const code = (err as { code?: string })?.code;

  if (status === 401 || code === "invalid_api_key") {
    return "The LLM API key was rejected (401 Unauthorized). Double check ANTHROPIC_API_KEY / OPENAI_API_KEY in .env.";
  }
  if (status === 429 || code === "insufficient_quota" || code === "rate_limit_exceeded") {
    return `The LLM provider rejected the request (429): ${raw}\nThis usually means the API key's account has no billing/credit set up, or you've hit a rate limit - check your provider's billing dashboard.`;
  }
  if (code === "ECONNREFUSED" || raw.includes("ECONNREFUSED") || raw.includes("ERR_CONNECTION_REFUSED")) {
    return `Could not connect: ${raw}\nIs the app under test (APP_BASE_URL/API_BASE_URL in .env) actually running?`;
  }
  return raw;
}

function runAction<A extends unknown[]>(fn: (...args: A) => Promise<void> | void) {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`\nError: ${friendlyErrorMessage(err)}`);
      process.exitCode = 1;
    }
  };
}

const program = new Command();
program.name("ai-test").description("Local AI-powered testing framework for fidar-server + CallCenterUI");

program
  .command("context")
  .description("Scan the backend and frontend repos and print a summary")
  .option("--force", "ignore the cache and rescan from scratch")
  .action(runAction((opts) => {
    const config = loadConfig();
    const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir, {
      forceRescan: !!opts.force,
    });
    const endpointCount = context.backend.controllers.reduce((n, c) => n + c.endpoints.length, 0);
    const testIdCount = context.frontend.components.reduce((n, c) => n + c.testIds.length, 0);
    console.log(`Backend:  ${context.backend.controllers.length} controllers, ${endpointCount} endpoints, ${context.backend.dtos.length} DTOs`);
    console.log(`Frontend: ${context.frontend.routes.length} routes, ${context.frontend.components.length} components, ${testIdCount} data-testids`);
    console.log(`Cached at: ${path.join(config.cacheDir, "context.json")}`);
  }));

program
  .command("plan")
  .description("Generate a test plan from a plain-English requirement")
  .argument("<requirement>", "the business requirement to test")
  .action(runAction(async (requirement: string) => {
    const config = loadConfig();
    const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
    const relevant = selectRelevantContext(requirement, context);
    const provider = getProvider(config);

    console.log(`Planning with provider=${provider.name}...`);
    const plan = await planScenarios(provider, requirement, relevant);

    const runId = newRunId();
    const runDir = path.join(config.runsDir, runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2));

    console.log(`\nGenerated ${plan.scenarios.length} scenario(s):`);
    for (const s of plan.scenarios) console.log(`  - [${s.id}] ${s.title}`);

    const issues = validatePlan(plan, context);
    if (issues.length > 0) {
      console.log(`\nWARNING: ${issues.length} pre-flight validation issue(s) found (will be reported as TEST_SCRIPT_ERROR on run):`);
      for (const issue of issues) console.log(`  - [${issue.scenarioId}] ${issue.message}`);
    }

    console.log(`\nPlan saved to ${runDir}/plan.json`);
    console.log(`Run it with: npm run run-plan -- ${runId}`);
  }));

program
  .command("run")
  .description("Execute a previously generated plan (by run id or path to a plan.json)")
  .argument("<planRef>", "run id under runs/, or a path to a plan.json file")
  .action(runAction(async (planRef: string) => {
    const config = loadConfig();
    const planPath = planRef.endsWith(".json") ? planRef : path.join(config.runsDir, planRef, "plan.json");
    const plan = TestPlanSchema.parse(JSON.parse(readFileSync(planPath, "utf-8")));

    const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
    const relevant = selectRelevantContext(plan.requirement, context);
    const provider = getProvider(config);

    const runId = planRef.endsWith(".json") ? newRunId() : planRef;
    console.log(`Running plan "${plan.requirement}" (provider=${provider.name}, runId=${runId})...`);

    const planRun = await runPlan(provider, config, plan, context, relevant);
    const runDir = saveRun(config.runsDir, runId, plan, planRun);

    console.log(`\nResults:`);
    for (const s of planRun.scenarioRuns) {
      const cls = s.classification ? ` -> ${s.classification.classification} (${Math.round(s.classification.confidence * 100)}%)` : "";
      console.log(`  - [${s.scenarioId}] ${s.result.status}${cls}`);
    }
    console.log(`\nSaved to ${runDir}`);
    console.log(`View with: npm run dashboard`);
  }));

program
  .command("all")
  .description("Plan and run in one step")
  .argument("<requirement>", "the business requirement to test")
  .option("--url <url>", "override APP_BASE_URL for this run")
  .action(runAction(async (requirement: string, opts: { url?: string }) => {
    const config = loadConfig();
    console.log(`Planning with provider=${getProvider(config).name}...`);
    const { runId, runDir } = await planAndRunOnce(config, requirement, opts.url);

    const { scenarios } = loadRunDetail(config.runsDir, runId);
    console.log(`\nResults:`);
    for (const s of scenarios) {
      const cls = s.classification ? ` -> ${s.classification.classification} (${Math.round(s.classification.confidence * 100)}%)` : "";
      console.log(`  - [${s.scenarioId}] ${s.result.status}${cls}`);
    }
    console.log(`\nSaved to ${runDir}`);
    console.log(`View with: npm run dashboard`);
  }));

program
  .command("dashboard")
  .description("Serve the local results dashboard")
  .action(runAction(() => {
    const config = loadConfig();
    const runs = listRuns(config.runsDir);
    console.log(`Found ${runs.length} run(s) in ${config.runsDir}`);
    startDashboard(config);
  }));

program.parseAsync(process.argv);
