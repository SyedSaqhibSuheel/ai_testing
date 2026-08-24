import type { ToolDef } from "../llm/types.js";

export const REPORT_RESULT_TOOL = "report_scenario_result";

/**
 * The synthetic local tool that is the ONLY way the executor's agentic
 * loop is allowed to terminate on its own (see src/executor/runScenario.ts).
 * Its schema mirrors src/schemas/scenarioResult.ts's ScenarioResultSchema -
 * kept as a hand-written JSON schema here (rather than derived from zod)
 * since it's small and stable, and providers need a plain JSON schema object.
 */
export const reportResultTool: ToolDef = {
  name: REPORT_RESULT_TOOL,
  description:
    "Call this exactly once, when and only when you have finished executing the scenario's steps (or determined you cannot proceed further), to report your final verdict. Do not call any other tool after this one.",
  inputSchema: {
    type: "object",
    properties: {
      scenarioId: { type: "string" },
      status: { type: "string", enum: ["PASS", "FAIL", "INCONCLUSIVE", "TIMEOUT"] },
      summary: { type: "string", description: "One or two sentence summary of what happened." },
      stepOutcomes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stepIndex: { type: "number" },
            passed: { type: "boolean" },
            observation: { type: "string" },
          },
          required: ["stepIndex", "passed", "observation"],
        },
      },
      failingStepIndex: { type: "number" },
      networkLog: {
        type: "array",
        items: {
          type: "object",
          properties: {
            method: { type: "string" },
            url: { type: "string" },
            status: { type: "number" },
            ok: { type: "boolean" },
            bodySnippet: { type: "string" },
          },
          required: ["method", "url"],
        },
      },
      finalSnapshotText: { type: "string" },
    },
    required: ["scenarioId", "status", "summary", "stepOutcomes"],
  },
};

export function withReportResultTool(mcpTools: ToolDef[]): ToolDef[] {
  return [...mcpTools, reportResultTool];
}

export const REPORT_EXPLORATION_TOOL = "report_exploration_findings";

/**
 * The termination tool for the Planner's live-exploration loop
 * (server/agents/exploreApp.ts) - same forced-tool-choice pattern as
 * `reportResultTool` above, but the objective is cataloguing (pages/testids/
 * flows), never pass/fail. `source` is always "live" here - the caller
 * merges this against the static scan afterward to tag "static"/"both".
 */
export const reportExplorationTool: ToolDef = {
  name: REPORT_EXPLORATION_TOOL,
  description:
    "Call this exactly once, when you have finished exploring the relevant parts of the application, to report what you found. Do not call any other tool after this one.",
  inputSchema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One or two sentence summary of what was explored." },
      discoveredRoutes: { type: "array", items: { type: "string" }, description: "URL paths actually visited/observed." },
      discoveredTestIds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            testId: { type: "string" },
            component: { type: "string", description: "Best guess at what UI element/section this belongs to." },
          },
          required: ["testId"],
        },
      },
      discoveredFlows: {
        type: "array",
        items: { type: "string" },
        description: "Short descriptions of user flows observed, e.g. 'Login -> Helpdesk -> Customer Search -> Customer Details'.",
      },
      crossReferenceNotes: {
        type: "array",
        items: { type: "string" },
        description: "Discrepancies noticed vs. the static code scan provided in context - e.g. a testid in the scan never reached live, or a route requiring auth you couldn't access.",
      },
    },
    required: ["summary", "discoveredRoutes", "discoveredTestIds", "discoveredFlows"],
  },
};

export function withReportExplorationTool(mcpTools: ToolDef[]): ToolDef[] {
  return [...mcpTools, reportExplorationTool];
}
