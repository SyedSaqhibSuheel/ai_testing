import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, scenarios, testFiles, testFileScenarios } from "../db/schema.js";
import type { Scenario } from "../../src/schemas/testPlan.js";
import { buildContext } from "../../src/context/buildContext.js";
import { isKnownAppUrl } from "../config/appProfile.js";
import { getProvider } from "../../src/llm/index.js";
import { GeneratedTestFileSchema } from "../schemas/generatedTest.js";
import { buildGeneratorSystemPrompt, buildGeneratorUserPrompt } from "./generatorPrompts.js";
import { validateGeneratedTest } from "./validateTestSyntax.js";
import { getLatestExplorationRun } from "./plannerAgent.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { getPlatformSettings } from "../settings/settingsService.js";
import { shouldAutoApprove } from "../approval/gate.js";
import { approveTestFile } from "../testFiles/testFileTransitions.js";
import { commitApprovedTestFiles, triggerAutoRunForCommittedFiles } from "../git/managedRepo.js";

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
  const [requirement] = await db.select().from(requirements).where(eq(requirements.id, requirementId));
  if (!requirement) throw new Error(`Requirement ${requirementId} not found`);

  const approvedScenarios = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.status, "approved_for_generation")));
  if (approvedScenarios.length === 0) {
    throw new Error("No scenarios approved for generation - approve a grounded plan first.");
  }

  const runId = await startAgentRun(db, { agentType: "generator", requirementId, input: { scenarioIds: approvedScenarios.map((s) => s.id) } });
  await db.update(requirements).set({ status: "generating_tests", updatedAt: new Date() }).where(eq(requirements.id, requirementId));

  try {
    await updateAgentRunTask(db, runId, "Generating tests");

    const groundedScenarios = approvedScenarios
      .map((s) => s.groundedPlan as Scenario | null)
      .filter((p): p is Scenario => p !== null);
    if (groundedScenarios.length === 0) {
      throw new Error("Approved scenarios have no grounded plan - run the Planner first.");
    }

    const isKnownApp = isKnownAppUrl(activeAppBaseUrl ?? config.appBaseUrl, config);
    const context = isKnownApp ? buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir) : null;
    const exploration = await getLatestExplorationRun(db, requirementId);
    const confirmedTestIds = new Set<string>([
      ...(context ? context.frontend.components.flatMap((c) => c.testIds) : []),
      ...((exploration?.discoveredTestIds as Array<{ testId: string }> | undefined)?.map((t) => t.testId) ?? []),
    ]);
    const confirmedRoutes = new Set<string>([
      ...(context ? context.frontend.routes.map((r) => r.path) : []),
      ...((exploration?.discoveredRoutes as string[] | undefined) ?? []),
    ]);

    // CallCenterUI's own login credentials only apply when the active target
    // IS CallCenterUI - a different site's login has nothing to do with them.
    const login =
      isKnownApp && config.appLoginUsername && config.appLoginPassword
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
    const settings = await getPlatformSettings(db, config);
    const testAppUrl = activeAppBaseUrl || settings.testAppUrl || config.appBaseUrl;

    const provider = getProvider(config);
    const chatResult = await provider.chat(
      [
        { role: "system", text: buildGeneratorSystemPrompt() },
        { role: "user", text: buildGeneratorUserPrompt(requirement.title, groundedScenarios, [...confirmedTestIds], [...confirmedRoutes], login, testAppUrl) },
      ],
      []
    );
    const parsed = GeneratedTestFileSchema.safeParse(extractJson(chatResult.text ?? ""));
    if (!parsed.success) {
      throw new Error(`Generator output failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    }

    await updateAgentRunTask(db, runId, "Validating generated code");
    const validation = validateGeneratedTest(parsed.data.code, confirmedTestIds);

    const [priorLatest] = await db
      .select({ version: testFiles.version })
      .from(testFiles)
      .where(eq(testFiles.requirementId, requirementId))
      .orderBy(desc(testFiles.version))
      .limit(1);
    const nextVersion = (priorLatest?.version ?? 0) + 1;
    await db.update(testFiles).set({ isLatest: false }).where(eq(testFiles.requirementId, requirementId));

    const [testFileRow] = await db
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
      .returning({ id: testFiles.id });

    for (const t of parsed.data.tests) {
      await db.insert(testFileScenarios).values({ testFileId: testFileRow.id, scenarioId: t.scenarioId, testTitle: t.testTitle });
    }

    await db.update(requirements).set({ status: "awaiting_test_approval", updatedAt: new Date() }).where(eq(requirements.id, requirementId));

    const { approvalMode } = await getPlatformSettings(db, config);
    let autoCommitted = false;
    if (validation.valid && shouldAutoApprove(approvalMode, "G3_generated_code", true)) {
      await approveTestFile(db, testFileRow.id, "system", "system_auto");
      if (shouldAutoApprove(approvalMode, "G4_commit", true)) {
        await commitApprovedTestFiles(db, config, [testFileRow.id], `Auto-commit: ${requirement.title}`, "system");
        await triggerAutoRunForCommittedFiles(db, config, [testFileRow.id]);
        autoCommitted = true;
      }
    }

    await completeAgentRun(db, runId, { testFileId: testFileRow.id, version: nextVersion, valid: validation.valid, autoCommitted });
    return testFileRow.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAgentRun(db, runId, message);
    await db.update(requirements).set({ status: "failed", updatedAt: new Date() }).where(eq(requirements.id, requirementId));
    throw err;
  }
}
