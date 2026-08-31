import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { testFiles, testRuns, testRunCases } from "../db/schema.js";
import { classifyTestFailure } from "../analysis/classifyTestFailure.js";

// Real, deterministic Playwright execution - no LLM involved. This is the
// "CI/CD runs the code, report appears in the dashboard" half of the flow;
// see also .github/workflows/playwright.yml in the managed repo for genuine
// cloud CI on push (that one doesn't feed back into this dashboard).

interface PwAttachment {
  name: string;
  contentType: string;
  path?: string;
}
interface PwResult {
  status: string;
  duration: number;
  error?: { message?: string; stack?: string };
  stdout?: unknown[];
  stderr?: unknown[];
  attachments?: PwAttachment[];
}
interface PwTest {
  results: PwResult[];
}
interface PwSpec {
  title: string;
  tests: PwTest[];
}
interface PwSuite {
  title: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  stats: { duration: number };
  suites: PwSuite[];
}

function collectSpecs(suites: PwSuite[] | undefined): Array<{ spec: PwSpec; suiteTitle?: string }> {
  const out: Array<{ spec: PwSpec; suiteTitle?: string }> = [];
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) out.push({ spec, suiteTitle: suite.title });
    out.push(...collectSpecs(suite.suites));
  }
  return out;
}

function toRelative(absPath: string | undefined, base: string): string | undefined {
  return absPath ? path.relative(base, absPath) : undefined;
}

function stringifyStd(entries: unknown[] | undefined): string[] {
  return (entries ?? []).map((e) => (typeof e === "string" ? e : JSON.stringify(e)));
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
function stripAnsi(text: string | undefined): string | undefined {
  return text?.replace(ANSI_PATTERN, "");
}

export async function runPlaywrightTest(
  db: Db,
  config: Config,
  testFileId: string,
  triggeredBy: "manual" | "auto_after_commit"
): Promise<string> {
  const file = db.select().from(testFiles).where(eq(testFiles.id, testFileId)).get();
  if (!file) throw new Error(`Test file ${testFileId} not found`);

  const runRow = db.insert(testRuns).values({ testFileId, triggeredBy, status: "running" }).returning({ id: testRuns.id }).get();
  const runId = runRow.id;
  const artifactsDir = path.join("test-results", runId);
  const jsonReportPath = path.join(config.managedRepoDir, artifactsDir, "report.json");
  db.update(testRuns).set({ artifactsDir }).where(eq(testRuns.id, runId)).run();

  try {
    // These are validation failures, not execution failures, but they must
    // still land as a visible `error` run (not a bare throw) - triggers are
    // fire-and-forget, so a throw here before any DB row existed would
    // silently vanish into a server log with nothing for the dashboard to
    // show.
    if (file.status !== "committed") {
      throw new Error(
        `Test file is "${file.status}", not "committed" - it hasn't been written into the managed repo yet, so there's nothing on disk to run. Commit it to Git first.`
      );
    }
    const playwrightBin = path.join(config.managedRepoDir, "node_modules", ".bin", "playwright");
    if (!existsSync(playwrightBin)) {
      throw new Error(
        `@playwright/test isn't installed in the managed repo (${config.managedRepoDir}). Run "npm install" there first.`
      );
    }
    const absTestFilePath = path.join(config.managedRepoDir, file.filePath);
    if (!existsSync(absTestFilePath)) {
      throw new Error(`Committed test file is missing from disk at ${absTestFilePath} - the managed repo may be out of sync.`);
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(playwrightBin, ["test", file.filePath, `--output=${artifactsDir}`], {
        cwd: config.managedRepoDir,
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: config.appBaseUrl,
          PLAYWRIGHT_JSON_OUTPUT_NAME: jsonReportPath,
        },
      });
      // A non-zero exit here just means "tests failed", not "execution errored" -
      // that distinction comes from whether a JSON report was produced at all.
      child.on("error", reject);
      child.on("close", () => resolve());
    });

    if (!existsSync(jsonReportPath)) {
      throw new Error("Playwright did not produce a JSON report - the run likely crashed before any test executed.");
    }
    const report: PwReport = JSON.parse(readFileSync(jsonReportPath, "utf-8"));
    const specs = collectSpecs(report.suites);
    if (specs.length === 0) {
      throw new Error(`Playwright matched 0 tests in ${file.filePath} - check the file actually contains test() blocks under testDir.`);
    }

    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failedCaseIds: string[] = [];

    for (const { spec, suiteTitle } of specs) {
      const result = spec.tests[0]?.results[0];
      if (!result) continue;
      const status = result.status as "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
      if (status === "passed") passed++;
      else if (status === "skipped") skipped++;
      else failed++;

      const screenshot = result.attachments?.find((a) => a.name === "screenshot");
      const trace = result.attachments?.find((a) => a.name === "trace");

      const caseRow = db
        .insert(testRunCases)
        .values({
          testRunId: runId,
          suiteTitle,
          title: spec.title,
          status,
          durationMs: Math.round(result.duration),
          errorMessage: stripAnsi(result.error?.message),
          errorStack: stripAnsi(result.error?.stack),
          screenshotPath: toRelative(screenshot?.path, config.managedRepoDir),
          tracePath: toRelative(trace?.path, config.managedRepoDir),
          stdout: stringifyStd(result.stdout),
          stderr: stringifyStd(result.stderr),
        })
        .returning({ id: testRunCases.id })
        .get();

      if (status === "failed" || status === "timedOut") failedCaseIds.push(caseRow.id);
    }

    db.update(testRuns)
      .set({
        status: failed > 0 ? "failed" : "passed",
        finishedAt: new Date(),
        durationMs: Math.round(report.stats.duration),
        totalTests: specs.length,
        passedCount: passed,
        failedCount: failed,
        skippedCount: skipped,
      })
      .where(eq(testRuns.id, runId))
      .run();

    // Classify each failure (real defect vs locator drift vs bad test vs
    // environment down) so only genuine REAL_DEFECT cases surface as a "Bug"
    // in the dashboard - sequential to respect free-tier LLM rate limits.
    // Best-effort: a classification failure shouldn't affect the run's own
    // recorded pass/fail result, which is already finalized above.
    for (const caseId of failedCaseIds) {
      await classifyTestFailure(db, config, caseId).catch((err) => {
        console.error(`Failed to classify test run case ${caseId}:`, err);
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.update(testRuns).set({ status: "error", errorMessage: message, finishedAt: new Date() }).where(eq(testRuns.id, runId)).run();
  }

  return runId;
}
