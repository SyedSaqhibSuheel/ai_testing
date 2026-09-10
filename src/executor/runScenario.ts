import type { LlmProvider, ChatMessage } from "../llm/types.js";
import type { PlaywrightMcpSession } from "../mcp/playwrightClient.js";
import { REPORT_RESULT_TOOL, withReportResultTool } from "../mcp/toolSchemaBridge.js";
import type { RelevantContext } from "../context/selectRelevantContext.js";
import type { Scenario } from "../schemas/testPlan.js";
import { ScenarioResultSchema, type NetworkLogEntry, type ScenarioResult, type TranscriptTurn } from "../schemas/scenarioResult.js";
import { buildExecutorSystemPrompt, buildExecutorUserPrompt } from "./prompts.js";
import { MAX_TURNS, WALL_CLOCK_TIMEOUT_MS } from "./types.js";
import { parseNetworkRequestsText } from "./parseNetworkLog.js";

export interface CapturedImage {
  turn: number;
  toolName: string;
  mimeType: string;
  base64: string;
}

export interface ScenarioRunOutput {
  result: ScenarioResult;
  transcript: TranscriptTurn[];
  images: CapturedImage[];
}

function timeoutResult(scenario: Scenario, reason: string): ScenarioResult {
  return {
    scenarioId: scenario.id,
    status: "TIMEOUT",
    summary: reason,
    stepOutcomes: scenario.steps.map((s) => ({
      stepIndex: s.index,
      passed: false,
      observation: "Not reached before the executor's turn cap / timeout.",
    })),
    networkLog: [],
  };
}

/**
 * Pulls network/console evidence directly from the browser (ground truth)
 * rather than relying on the model's self-reported networkLog, which can be
 * wrong or simply left empty. Returns the parsed network log so callers can
 * use it as the authoritative record.
 */
async function captureSideChannel(
  mcpSession: PlaywrightMcpSession,
  transcript: TranscriptTurn[],
  turn: number
): Promise<NetworkLogEntry[]> {
  let groundTruthNetworkLog: NetworkLogEntry[] = [];
  for (const toolName of ["browser_network_requests", "browser_console_messages"]) {
    if (!mcpSession.tools.some((t) => t.name === toolName)) continue;
    try {
      const res = await mcpSession.callTool(toolName, {});
      transcript.push({
        turn,
        role: "tool",
        toolName,
        toolOutputSummary: res.text.slice(0, 4000),
        timestamp: new Date().toISOString(),
      });
      if (toolName === "browser_network_requests") {
        groundTruthNetworkLog = parseNetworkRequestsText(res.text);
      }
    } catch {
      // Side-channel evidence is best-effort; a failure here shouldn't abort the scenario.
    }
  }
  return groundTruthNetworkLog;
}

/** Ground-truth network capture overrides the model's self-reported networkLog when available. */
function withGroundTruthNetworkLog(result: ScenarioResult, groundTruth: NetworkLogEntry[]): ScenarioResult {
  return groundTruth.length > 0 ? { ...result, networkLog: groundTruth } : result;
}

export async function runScenario(
  provider: LlmProvider,
  mcpSession: PlaywrightMcpSession,
  scenario: Scenario,
  context: RelevantContext,
  appBaseUrl: string,
  login?: { username: string; password: string }
): Promise<ScenarioRunOutput> {
  const tools = withReportResultTool(mcpSession.tools);
  const transcript: TranscriptTurn[] = [];
  const images: CapturedImage[] = [];

  const messages: ChatMessage[] = [
    { role: "system", text: buildExecutorSystemPrompt(appBaseUrl, login) },
    { role: "user", text: buildExecutorUserPrompt(scenario, context) },
  ];

  const startedAt = Date.now();
  let turn = 0;

  while (turn < MAX_TURNS) {
    if (Date.now() - startedAt > WALL_CLOCK_TIMEOUT_MS) {
      const groundTruth = await captureSideChannel(mcpSession, transcript, turn);
      const result = withGroundTruthNetworkLog(
        timeoutResult(scenario, `Wall-clock timeout after ${WALL_CLOCK_TIMEOUT_MS}ms.`),
        groundTruth
      );
      return { result, transcript, images };
    }

    const isLastAllowedTurn = turn === MAX_TURNS - 1;
    const forceTool = isLastAllowedTurn ? { name: REPORT_RESULT_TOOL } : undefined;

    const turnResult = await provider.chat(messages, tools, forceTool);
    turn += 1;

    messages.push({ role: "assistant", text: turnResult.text, toolCalls: turnResult.toolCalls });

    const reportCall = turnResult.toolCalls.find((c) => c.name === REPORT_RESULT_TOOL);
    if (reportCall) {
      const parsed = ScenarioResultSchema.safeParse(reportCall.input);
      const groundTruth = await captureSideChannel(mcpSession, transcript, turn);
      if (parsed.success) {
        return { result: withGroundTruthNetworkLog(parsed.data, groundTruth), transcript, images };
      }
      return {
        result: withGroundTruthNetworkLog(
          {
            scenarioId: scenario.id,
            status: "INCONCLUSIVE",
            summary: `Model's report_scenario_result call did not match the expected schema: ${JSON.stringify(parsed.error.issues)}`,
            stepOutcomes: [],
            networkLog: [],
          },
          groundTruth
        ),
        transcript,
        images,
      };
    }

    if (turnResult.toolCalls.length === 0) {
      // Model produced a plain-text turn with no tool call and we're not
      // forcing one yet - nudge it rather than silently ending.
      messages.push({
        role: "user",
        text: "Continue executing the scenario using the available tools, or call report_scenario_result if you are done.",
      });
      continue;
    }

    for (const call of turnResult.toolCalls) {
      transcript.push({
        turn,
        role: "assistant",
        toolName: call.name,
        toolInput: call.input,
        timestamp: new Date().toISOString(),
      });

      try {
        const { text, images: callImages, isError } = await mcpSession.callTool(call.name, call.input);
        transcript.push({
          turn,
          role: "tool",
          toolName: call.name,
          toolOutputSummary: text.slice(0, 4000),
          timestamp: new Date().toISOString(),
        });
        for (const img of callImages) {
          images.push({ turn, toolName: call.name, mimeType: img.mimeType, base64: img.base64 });
        }
        messages.push({ role: "tool", toolCallId: call.id, toolResultText: text, toolIsError: isError });
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        transcript.push({
          turn,
          role: "tool",
          toolName: call.name,
          toolOutputSummary: `ERROR: ${errorText}`,
          timestamp: new Date().toISOString(),
        });
        messages.push({ role: "tool", toolCallId: call.id, toolResultText: `ERROR: ${errorText}`, toolIsError: true });
      }
    }
  }

  const groundTruth = await captureSideChannel(mcpSession, transcript, turn);
  return {
    result: withGroundTruthNetworkLog(
      timeoutResult(scenario, `Turn cap (${MAX_TURNS}) reached without a report_scenario_result call.`),
      groundTruth
    ),
    transcript,
    images,
  };
}
