import type { ChatMessage, ChatTurnResult, ForcedTool, LlmProvider, ToolCall, ToolDef } from "./types.js";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `mock_call_${counter}`;
}

function extractFirst(pattern: RegExp, messages: ChatMessage[]): string | undefined {
  const haystack = messages.map((m) => m.text ?? "").join("\n");
  return haystack.match(pattern)?.[1];
}

/**
 * A deterministic, fully offline LLM stand-in. It lets the whole
 * plan -> execute -> classify -> store -> dashboard pipeline be exercised
 * end-to-end (including the real Playwright MCP process and the executor's
 * forced-tool-choice termination path) without an Anthropic/OpenAI API key.
 * It is NOT a substitute for judging real planner/classifier quality.
 */
export function createMockProvider(appBaseUrl: string): LlmProvider {
  return {
    name: "mock",
    async chat(messages: ChatMessage[], tools: ToolDef[], forceTool?: ForcedTool): Promise<ChatTurnResult> {
      const systemText = messages.find((m) => m.role === "system")?.text ?? "";

      // No tools => this is a structured-JSON generation call (planner or analyzer).
      if (tools.length === 0) {
        if (/MOCK_TASK:\s*plan/.test(systemText)) {
          const requirement = extractFirst(/REQUIREMENT:\s*(.+)/, messages) ?? "Untitled requirement";
          const plan = {
            requirement,
            generatedAt: new Date().toISOString(),
            scenarios: [
              {
                id: "scenario-1",
                title: `Verify: ${requirement.slice(0, 80)}`,
                requirementRef: requirement,
                preconditions: ["App is running and reachable at the configured base URL."],
                steps: [
                  { index: 0, action: "Navigate to the application base URL.", notes: "mock-generated step" },
                  { index: 1, action: "Take an accessibility snapshot and confirm the page loaded.", notes: "mock-generated step" },
                ],
                expectedBackendCalls: [],
                expectedUiOutcomes: ["The application shell renders without a crash."],
                passCriteria: ["The page loads and no console/network errors are observed."],
              },
            ],
          };
          return { text: JSON.stringify(plan, null, 2), toolCalls: [], stopReason: "end_turn" };
        }

        if (/MOCK_TASK:\s*intelligence/.test(systemText)) {
          const requirement = extractFirst(/REQUIREMENT:\s*(.+)/, messages) ?? "Untitled requirement";
          const analysis = {
            functionalRequirements: [{ description: `System must satisfy: ${requirement.slice(0, 120)}` }],
            userRoles: ["Administrator", "Normal user"],
            validationRules: ["Mandatory fields must be validated.", "Duplicate values must be rejected."],
            riskAreas: [{ area: "Validation", reason: "Mock analysis - real validation edge cases need a real model." }],
            suggestedCoverage: ["Happy path", "Missing required fields", "Duplicate submission", "Unauthorized role"],
            scenarios: [
              {
                title: `Happy path: ${requirement.slice(0, 60)}`,
                description: "The primary flow succeeds with valid input.",
                scenarioType: "positive",
                priority: "high",
                riskLevel: "medium",
                preconditions: ["User is authenticated with the correct role."],
                draftSteps: ["Navigate to the relevant page.", "Fill in valid data.", "Submit."],
                expectedResult: "The action succeeds and the new state is reflected in the UI.",
                aiConfidence: 0.8,
              },
              {
                title: `Negative: duplicate/invalid input for ${requirement.slice(0, 40)}`,
                description: "The system must reject invalid or duplicate input.",
                scenarioType: "negative",
                priority: "high",
                riskLevel: "high",
                preconditions: ["User is authenticated with the correct role."],
                draftSteps: ["Navigate to the relevant page.", "Submit invalid/duplicate data."],
                expectedResult: "A clear validation error is shown and no invalid state is persisted.",
                aiConfidence: 0.75,
              },
            ],
          };
          return { text: JSON.stringify(analysis, null, 2), toolCalls: [], stopReason: "end_turn" };
        }

        if (/MOCK_TASK:\s*ground/.test(systemText)) {
          const haystack = messages.map((m) => m.text ?? "").join("\n");
          const ids = [...haystack.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
          const uniqueIds = [...new Set(ids)];
          const plans = uniqueIds.map((id, i) => ({
            id,
            title: `Grounded scenario ${i + 1}`,
            requirementRef: extractFirst(/REQUIREMENT:\s*(.+)/, messages) ?? "",
            preconditions: ["App is running and reachable."],
            steps: [
              { index: 0, action: "Navigate to the application base URL.", notes: "mock-grounded step" },
              { index: 1, action: "Take an accessibility snapshot and confirm the page loaded.", notes: "mock-grounded step" },
            ],
            expectedBackendCalls: [],
            expectedUiOutcomes: ["The application shell renders without a crash."],
            passCriteria: ["The page loads and no console/network errors are observed."],
          }));
          return { text: JSON.stringify({ plans }, null, 2), toolCalls: [], stopReason: "end_turn" };
        }

        if (/MOCK_TASK:\s*generate/.test(systemText)) {
          const haystack = messages.map((m) => m.text ?? "").join("\n");
          const requirementTitle = extractFirst(/REQUIREMENT TITLE:\s*(.+)/, messages) ?? "Requirement";
          const ids = [...new Set([...haystack.matchAll(/"id"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))];
          const tests = ids.map((id, i) => ({ scenarioId: id, testTitle: `Mock generated test ${i + 1}` }));
          const testBlocks = tests
            .map((t) => `  test(${JSON.stringify(t.testTitle)}, async ({ page }) => {\n    await page.goto("/");\n    await expect(page).toHaveURL("/");\n  });`)
            .join("\n\n");
          const code = [
            `import { test, expect } from "@playwright/test";`,
            "",
            `test.describe(${JSON.stringify(requirementTitle)}, () => {`,
            testBlocks,
            "});",
            "",
          ].join("\n");
          return { text: JSON.stringify({ code, tests }, null, 2), toolCalls: [], stopReason: "end_turn" };
        }

        if (/MOCK_TASK:\s*classify/.test(systemText)) {
          const scenarioId = extractFirst(/"scenarioId"\s*:\s*"([^"]+)"/, messages) ?? "unknown-scenario";
          const haystack = messages.map((m) => m.text ?? "").join("\n");
          const looksLikeConnectionFailure = /ERR_CONNECTION_REFUSED|ECONNREFUSED|net::ERR_/.test(haystack);

          const classification = looksLikeConnectionFailure
            ? {
                scenarioId,
                classification: "ENVIRONMENT_ERROR",
                confidence: 0.9,
                evidenceKind: "HTTP_STATUS",
                evidence: ["Transcript shows a connection-refused/network-level failure before any HTTP response was observed."],
                reasoning:
                  "The browser could not reach the configured APP_BASE_URL at all (connection refused), which is checked first and classified as an environment problem rather than a product defect: most likely the app under test isn't running yet.",
                suggestedFix: "Start the CallCenterUI dev server (and fidar-server) and confirm APP_BASE_URL in .env matches, then re-run.",
              }
            : {
            scenarioId,
            classification: "INCONCLUSIVE",
            confidence: 0.3,
            evidenceKind: "NARRATIVE_INFERENCE",
            evidence: ["LLM_PROVIDER=mock - no real model was consulted for this classification."],
            reasoning:
              "Running in mock mode: this is a deterministic placeholder verdict used to verify pipeline wiring, not a real defect analysis.",
            suggestedFix: "Set LLM_PROVIDER=anthropic or openai with a real API key to get an actual classification.",
          };
          return { text: JSON.stringify(classification, null, 2), toolCalls: [], stopReason: "end_turn" };
        }

        return { text: "{}", toolCalls: [], stopReason: "end_turn" };
      }

      // Tools present => this is an agentic loop (scenario executor or app explorer).
      const reportTool = tools.find((t) => t.name === "report_scenario_result" || t.name === "report_exploration_findings");
      const turnIndex = messages.filter((m) => m.role === "assistant").length;

      if (forceTool) {
        return buildReportCall(reportTool, messages);
      }

      if (turnIndex === 0) {
        const navigate = tools.find((t) => t.name === "browser_navigate");
        if (navigate) {
          const call: ToolCall = { id: nextId(), name: navigate.name, input: { url: appBaseUrl } };
          return { toolCalls: [call], stopReason: "tool_use" };
        }
      }

      if (turnIndex === 1) {
        const snapshot = tools.find((t) => t.name === "browser_snapshot");
        if (snapshot) {
          const call: ToolCall = { id: nextId(), name: snapshot.name, input: {} };
          return { toolCalls: [call], stopReason: "tool_use" };
        }
      }

      return buildReportCall(reportTool, messages);
    },
  };
}

function buildReportCall(reportTool: ToolDef | undefined, messages: ChatMessage[]): ChatTurnResult {
  if (!reportTool) return { text: "mock provider has no report tool available", toolCalls: [], stopReason: "end_turn" };

  const toolMessages = messages.filter((m) => m.role === "tool");
  const lastToolText = [...toolMessages].reverse()[0]?.toolResultText ?? "";
  const hadError = toolMessages.some((m) => m.toolIsError);

  if (reportTool.name === "report_exploration_findings") {
    const call: ToolCall = {
      id: nextId(),
      name: reportTool.name,
      input: {
        summary: hadError
          ? "Mock exploration hit a tool error while navigating."
          : "Mock exploration completed: navigated to the app and captured a snapshot.",
        discoveredRoutes: ["/"],
        discoveredTestIds: [],
        discoveredFlows: [],
        crossReferenceNotes: hadError ? [`Tool error observed: ${lastToolText.slice(0, 200)}`] : [],
      },
    };
    return { toolCalls: [call], stopReason: "tool_use" };
  }

  const scenarioId = extractFirst(/"id"\s*:\s*"([^"]+)"/, messages) ?? "scenario-1";

  const call: ToolCall = {
    id: nextId(),
    name: reportTool.name,
    input: hadError
      ? {
          scenarioId,
          status: "FAIL",
          summary: "Mock run observed a tool error (e.g. the app under test was unreachable) while executing steps.",
          stepOutcomes: [
            { stepIndex: 0, passed: false, observation: "A browser tool call returned an error - see finalSnapshotText." },
          ],
          failingStepIndex: 0,
          networkLog: [],
          finalSnapshotText: lastToolText.slice(0, 500),
        }
      : {
          scenarioId,
          status: "PASS",
          summary: "Mock run completed: navigated to the app and captured a snapshot without error.",
          stepOutcomes: [
            { stepIndex: 0, passed: true, observation: "Navigation tool call succeeded." },
            { stepIndex: 1, passed: true, observation: "Snapshot tool call succeeded." },
          ],
          networkLog: [],
          finalSnapshotText: lastToolText.slice(0, 500),
        },
  };
  return { toolCalls: [call], stopReason: "tool_use" };
}
