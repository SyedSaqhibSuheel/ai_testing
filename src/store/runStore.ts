import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { TestPlan } from "../schemas/testPlan.js";
import type { PlanRunSummary } from "../executor/runPlan.js";

export interface RunSummaryFile {
  runId: string;
  requirement: string;
  startedAt: string;
  finishedAt: string;
  scenarios: Array<{
    scenarioId: string;
    title: string;
    status: string;
    classification?: string;
    confidence?: number;
  }>;
}

function mimeToExt(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "bin";
}

export function newRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function saveRun(runsDir: string, runId: string, plan: TestPlan, planRun: PlanRunSummary): string {
  const runDir = path.join(runsDir, runId);
  mkdirSync(runDir, { recursive: true });

  writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2));

  const scenarioSummaries: RunSummaryFile["scenarios"] = [];

  for (const run of planRun.scenarioRuns) {
    const scenarioDir = path.join(runDir, "scenarios", run.scenarioId);
    const screenshotsDir = path.join(scenarioDir, "screenshots");
    mkdirSync(screenshotsDir, { recursive: true });

    writeFileSync(path.join(scenarioDir, "transcript.json"), JSON.stringify(run.transcript, null, 2));

    const screenshotFiles: string[] = [];
    run.images.forEach((img, i) => {
      const filename = `${String(i).padStart(2, "0")}-${img.toolName}.${mimeToExt(img.mimeType)}`;
      writeFileSync(path.join(screenshotsDir, filename), Buffer.from(img.base64, "base64"));
      screenshotFiles.push(filename);
    });

    writeFileSync(
      path.join(scenarioDir, "result.json"),
      JSON.stringify({ result: run.result, classification: run.classification, screenshotFiles, startedAt: run.startedAt, finishedAt: run.finishedAt }, null, 2)
    );

    const scenario = plan.scenarios.find((s) => s.id === run.scenarioId);
    scenarioSummaries.push({
      scenarioId: run.scenarioId,
      title: scenario?.title ?? run.scenarioId,
      status: run.result.status,
      classification: run.classification?.classification,
      confidence: run.classification?.confidence,
    });
  }

  const summary: RunSummaryFile = {
    runId,
    requirement: planRun.requirement,
    startedAt: planRun.startedAt,
    finishedAt: planRun.finishedAt,
    scenarios: scenarioSummaries,
  };
  writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));

  return runDir;
}

export function listRuns(runsDir: string): RunSummaryFile[] {
  if (!existsSync(runsDir)) return [];
  const runs: RunSummaryFile[] = [];
  for (const entry of readdirSync(runsDir).sort().reverse()) {
    const summaryPath = path.join(runsDir, entry, "summary.json");
    if (!existsSync(summaryPath)) continue;
    try {
      runs.push(JSON.parse(readFileSync(summaryPath, "utf-8")));
    } catch {
      continue;
    }
  }
  return runs;
}

export function loadRunDetail(runsDir: string, runId: string) {
  const runDir = path.join(runsDir, runId);
  const summary = JSON.parse(readFileSync(path.join(runDir, "summary.json"), "utf-8"));
  const plan = JSON.parse(readFileSync(path.join(runDir, "plan.json"), "utf-8"));

  const scenarios = summary.scenarios.map((s: { scenarioId: string }) => {
    const scenarioDir = path.join(runDir, "scenarios", s.scenarioId);
    const transcript = JSON.parse(readFileSync(path.join(scenarioDir, "transcript.json"), "utf-8"));
    const resultFile = JSON.parse(readFileSync(path.join(scenarioDir, "result.json"), "utf-8"));
    return { scenarioId: s.scenarioId, transcript, ...resultFile };
  });

  return { summary, plan, scenarios };
}
