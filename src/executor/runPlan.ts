import type { Config } from "../config.js";
import type { LlmProvider } from "../llm/types.js";
import type { AppContext } from "../context/types.js";
import type { RelevantContext } from "../context/selectRelevantContext.js";
import type { TestPlan } from "../schemas/testPlan.js";
import type { ScenarioResult, TranscriptTurn } from "../schemas/scenarioResult.js";
import type { ClassificationResult } from "../schemas/classification.js";
import { validatePlan } from "../planner/validatePlan.js";
import { classifyFailure, testScriptErrorClassification } from "../analyzer/classifyFailure.js";
import { startPlaywrightMcp } from "../mcp/playwrightClient.js";
import { runScenario, type CapturedImage } from "./runScenario.js";

export interface ScenarioRunRecord {
  scenarioId: string;
  result: ScenarioResult;
  transcript: TranscriptTurn[];
  images: CapturedImage[];
  classification?: ClassificationResult;
  startedAt: string;
  finishedAt: string;
}

export interface PlanRunSummary {
  requirement: string;
  startedAt: string;
  finishedAt: string;
  scenarioRuns: ScenarioRunRecord[];
}

export async function runPlan(
  provider: LlmProvider,
  config: Config,
  plan: TestPlan,
  fullContext: AppContext,
  relevantContext: RelevantContext
): Promise<PlanRunSummary> {
  const startedAt = new Date().toISOString();
  const validationIssues = validatePlan(plan, fullContext);
  const issuesByScenario = new Map<string, string[]>();
  for (const issue of validationIssues) {
    const list = issuesByScenario.get(issue.scenarioId) ?? [];
    list.push(issue.stepIndex !== undefined ? `[step ${issue.stepIndex}] ${issue.message}` : issue.message);
    issuesByScenario.set(issue.scenarioId, list);
  }

  const mcpSession = await startPlaywrightMcp(config.rootDir, config.mcpHeadless);
  const scenarioRuns: ScenarioRunRecord[] = [];

  try {
    for (const scenario of plan.scenarios) {
      const scenarioStartedAt = new Date().toISOString();
      const preflightIssues = issuesByScenario.get(scenario.id);

      if (preflightIssues) {
        scenarioRuns.push({
          scenarioId: scenario.id,
          result: {
            scenarioId: scenario.id,
            status: "FAIL",
            summary: "Skipped execution: scenario failed pre-flight validation against the current codebase scan.",
            stepOutcomes: [],
            networkLog: [],
          },
          transcript: [],
          images: [],
          classification: testScriptErrorClassification(scenario.id, preflightIssues),
          startedAt: scenarioStartedAt,
          finishedAt: new Date().toISOString(),
        });
        continue;
      }

      const login =
        config.appLoginUsername && config.appLoginPassword
          ? { username: config.appLoginUsername, password: config.appLoginPassword }
          : undefined;

      const { result, transcript, images } = await runScenario(
        provider,
        mcpSession,
        scenario,
        relevantContext,
        config.appBaseUrl,
        login
      );

      let classification: ClassificationResult | undefined;
      if (result.status !== "PASS") {
        classification = await classifyFailure(provider, plan.requirement, scenario, result, transcript, relevantContext);
      }

      scenarioRuns.push({
        scenarioId: scenario.id,
        result,
        transcript,
        images,
        classification,
        startedAt: scenarioStartedAt,
        finishedAt: new Date().toISOString(),
      });
    }
  } finally {
    await mcpSession.close();
  }

  return { requirement: plan.requirement, startedAt, finishedAt: new Date().toISOString(), scenarioRuns };
}
