import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, scenarios, testFiles, testFileScenarios } from "../db/schema.js";
import type { Scenario } from "../../src/schemas/testPlan.js";
import { buildContext } from "../../src/context/buildContext.js";
import { resolveAppConfig, hasSourceAccess } from "../config/activeApplication.js";
import { getProvider } from "../../src/llm/index.js";
import { GeneratedTestFileSchema } from "../schemas/generatedTest.js";
import { buildGeneratorSystemPrompt, buildGeneratorUserPrompt } from "./generatorPrompts.js";
import { validateGeneratedTest, isConfirmedTestId } from "./validateTestSyntax.js";
import { getLatestExplorationRun } from "./plannerAgent.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { getPlatformSettings } from "../settings/settingsService.js";
import { shouldAutoApprove } from "../approval/gate.js";
import { approveTestFile } from "../testFiles/testFileTransitions.js";
import { commitApprovedTestFiles } from "../git/managedRepo.js";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "requirement"
  );
}

/**
 * Runs the Playwright Generator for a requirement: converts every
 * `approved_for_generation` scenario into one grouped .spec.ts file (one
 * test.describe, one test() per scenario), validates it (syntax + locator
 * hallucination) without executing it, and stores it as a new version.
 * Callable again to regenerate - always creates a new version rather than
 * overwriting.
 */
export async function runGeneratorAgent(db: Db, config: Config, requirementId: string, activeAppBaseUrl?: string): Promise<string> {
  config = resolveAppConfig(db, config);
  const requirement = db.select().from(requirements).where(eq(requirements.id, requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${requirementId} not found`);

  const approvedScenarios = db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.status, "approved_for_generation")))
    .all();
  if (approvedScenarios.length === 0) {
    throw new Error("No scenarios approved for generation - approve a grounded plan first.");
  }

  const runId = startAgentRun(db, { agentType: "generator", requirementId, input: { scenarioIds: approvedScenarios.map((s) => s.id) } });
  db.update(requirements).set({ status: "generating_tests", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();

  try {
    updateAgentRunTask(db, runId, "Generating tests");

    const groundedScenarios = approvedScenarios
      .map((s) => s.groundedPlan as Scenario | null)
      .filter((p): p is Scenario => p !== null);
    if (groundedScenarios.length === 0) {
      throw new Error("Approved scenarios have no grounded plan - run the Planner first.");
    }

    const context = hasSourceAccess(config) ? buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir) : null;
    const exploration = getLatestExplorationRun(db, requirementId);
    const staticTestIds = new Set<string>(context ? context.frontend.components.flatMap((c) => c.testIds) : []);
    // The explorer is an LLM self-reporting what it saw, and it does invent
    // plausible ids (e.g. "input-username" on a login form with no testids).
    // When the real source is available, a live-only id is kept only if the
    // source actually renders it (exactly or as a dynamic-pattern instance).
    const exploredTestIds = ((exploration?.discoveredTestIds as Array<{ testId: string; source?: string }> | undefined) ?? [])
      .filter((t) => !context || t.source !== "live" || isConfirmedTestId(t.testId, staticTestIds))
      .map((t) => t.testId);
    const confirmedTestIds = new Set<string>([...staticTestIds, ...exploredTestIds]);
    const confirmedRoutes = new Set<string>([
      ...(context ? context.frontend.routes.map((r) => r.path) : []),
      ...((exploration?.discoveredRoutes as string[] | undefined) ?? []),
    ]);
    // Which screen/component renders each testid, so the Generator knows e.g.
    // that a details-panel id only exists after the list item that opens the
    // panel has been selected - not just that the id exists somewhere.
    const testIdComponents = new Map<string, Set<string>>();
    const addComponent = (testId: string, component: string | undefined) => {
      if (!component) return;
      if (!testIdComponents.has(testId)) testIdComponents.set(testId, new Set());
      testIdComponents.get(testId)!.add(component);
    };
    for (const c of context?.frontend.components ?? []) {
      for (const t of c.testIds) addComponent(t, c.componentName ?? path.basename(c.file, path.extname(c.file)));
    }
    for (const t of (exploration?.discoveredTestIds as Array<{ testId: string; component?: string }> | undefined) ?? []) {
      if (confirmedTestIds.has(t.testId)) addComponent(t.testId, t.component);
    }

    // Plans grounded before invented ids were filtered out may still name
    // them, and the model follows the plan over any prompt rule. Strip them
    // here so the model never sees an unconfirmed testid as an instruction.
    const planScenarios = groundedScenarios.map((s) => ({
      ...s,
      steps: s.steps.map((step) => {
        if (!step.targetTestId || isConfirmedTestId(step.targetTestId, confirmedTestIds)) return step;
        const { targetTestId, ...rest } = step;
        const note = `No data-testid exists for this element (the plan's "${targetTestId}" is not in the app). If it is a login field or the sign-in button, use the LOGIN LOCATORS; otherwise locate it with getByRole/getByText by its visible label.`;
        return { ...rest, notes: rest.notes ? `${rest.notes} ${note}` : note };
      }),
    }));

    // Login is the active application's own credentials, independent of
    // whether its source code is available to scan.
    const login =
      config.appLoginUsername && config.appLoginPassword
        ? {
            username: config.appLoginUsername,
            password: config.appLoginPassword,
            usernameLocator: config.appLoginUsernameLocator,
            passwordLocator: config.appLoginPasswordLocator,
            submitLocator: config.appLoginSubmitLocator,
          }
        : undefined;

    // Prefer the caller's active URL-config profile (Settings > Environment
    // configuration) over the legacy single testAppUrl setting, then .env.
    const settings = getPlatformSettings(db, config);
    const testAppUrl = activeAppBaseUrl || settings.testAppUrl || config.appBaseUrl;

    const provider = getProvider(config);
    const chatResult = await provider.chat(
      [
        { role: "system", text: buildGeneratorSystemPrompt() },
        {
          role: "user",
          text: buildGeneratorUserPrompt(requirement.title, planScenarios, [...confirmedTestIds], [...confirmedRoutes], login, testAppUrl, testIdComponents),
        },
      ],
      []
    );
    const parsed = GeneratedTestFileSchema.safeParse(extractJson(chatResult.text ?? ""));
    if (!parsed.success) {
      throw new Error(`Generator output failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    }

    updateAgentRunTask(db, runId, "Validating generated code");
    const validation = validateGeneratedTest(parsed.data.code, confirmedTestIds);

    const priorLatest = db
      .select({ version: testFiles.version })
      .from(testFiles)
      .where(eq(testFiles.requirementId, requirementId))
      .orderBy(desc(testFiles.version))
      .get();
    const nextVersion = (priorLatest?.version ?? 0) + 1;
    db.update(testFiles).set({ isLatest: false }).where(eq(testFiles.requirementId, requirementId)).run();

    const testFileRow = db
      .insert(testFiles)
      .values({
        requirementId,
        filePath: `tests/generated/${slugify(requirement.title)}.spec.ts`,
        version: nextVersion,
        code: parsed.data.code,
        status: validation.valid ? "syntax_valid" : "syntax_invalid",
        validationError: validation.error,
        generatedByAgentRunId: runId,
        isLatest: true,
      })
      .returning({ id: testFiles.id })
      .get();

    for (const t of parsed.data.tests) {
      db.insert(testFileScenarios)
        .values({ testFileId: testFileRow.id, scenarioId: t.scenarioId, testTitle: t.testTitle })
        .run();
    }

    db.update(requirements).set({ status: "awaiting_test_approval", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();

    const { approvalMode } = getPlatformSettings(db, config);
    let autoCommitted = false;
    if (validation.valid && shouldAutoApprove(approvalMode, "G3_generated_code", true)) {
      approveTestFile(db, testFileRow.id, "system", "system_auto");
      if (shouldAutoApprove(approvalMode, "G4_commit", true)) {
        await commitApprovedTestFiles(db, config, [testFileRow.id], `Auto-commit: ${requirement.title}`, "system");
        autoCommitted = true;
      }
    }

    completeAgentRun(db, runId, { testFileId: testFileRow.id, version: nextVersion, valid: validation.valid, autoCommitted });
    return testFileRow.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failAgentRun(db, runId, message);
    db.update(requirements).set({ status: "failed", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();
    throw err;
  }
}
