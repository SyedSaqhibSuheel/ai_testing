import type { LlmProvider, ChatMessage } from "../../src/llm/types.js";
import type { PlaywrightMcpSession } from "../../src/mcp/playwrightClient.js";
import { REPORT_EXPLORATION_TOOL, withReportExplorationTool } from "../../src/mcp/toolSchemaBridge.js";
import type { RelevantContext } from "../../src/context/selectRelevantContext.js";
import type { TranscriptTurn } from "../../src/schemas/scenarioResult.js";
import { ExplorationFindingsSchema, type ExplorationFindings } from "../schemas/exploration.js";
import { buildExploreSystemPrompt, buildExploreUserPrompt } from "./explorePrompts.js";

// Cataloguing is cheaper than executing+asserting, so a tighter budget than
// scenario execution's 40 turns / 180s is appropriate.
const MAX_TURNS = 25;
const WALL_CLOCK_TIMEOUT_MS = 120_000;

export interface CapturedImage {
  turn: number;
  toolName: string;
  mimeType: string;
  base64: string;
}

export interface ExploreAppOutput {
  findings: ExplorationFindings;
  status: "completed" | "timeout";
  transcript: TranscriptTurn[];
  images: CapturedImage[];
}

function timeoutFindings(reason: string): ExplorationFindings {
  return { summary: reason, discoveredRoutes: [], discoveredTestIds: [], discoveredFlows: [], crossReferenceNotes: [] };
}

export async function exploreApp(
  provider: LlmProvider,
  mcpSession: PlaywrightMcpSession,
  requirementText: string,
  approvedScenarios: Array<{ title: string; preconditions: string[] }>,
  context: RelevantContext,
  appBaseUrl: string
): Promise<ExploreAppOutput> {
  const tools = withReportExplorationTool(mcpSession.tools);
  const transcript: TranscriptTurn[] = [];
  const images: CapturedImage[] = [];

  const messages: ChatMessage[] = [
    { role: "system", text: buildExploreSystemPrompt(appBaseUrl) },
    { role: "user", text: buildExploreUserPrompt(requirementText, approvedScenarios, context) },
  ];

  const startedAt = Date.now();
  let turn = 0;

  while (turn < MAX_TURNS) {
    if (Date.now() - startedAt > WALL_CLOCK_TIMEOUT_MS) {
      return { findings: timeoutFindings(`Wall-clock timeout after ${WALL_CLOCK_TIMEOUT_MS}ms.`), status: "timeout", transcript, images };
    }

    const isLastAllowedTurn = turn === MAX_TURNS - 1;
    const forceTool = isLastAllowedTurn ? { name: REPORT_EXPLORATION_TOOL } : undefined;

    const turnResult = await provider.chat(messages, tools, forceTool);
    turn += 1;

    messages.push({ role: "assistant", text: turnResult.text, toolCalls: turnResult.toolCalls });

    const reportCall = turnResult.toolCalls.find((c) => c.name === REPORT_EXPLORATION_TOOL);
    if (reportCall) {
      const parsed = ExplorationFindingsSchema.safeParse(reportCall.input);
      if (parsed.success) {
        return { findings: parsed.data, status: "completed", transcript, images };
      }
      return {
        findings: timeoutFindings(`Model's report_exploration_findings call did not match the expected schema: ${JSON.stringify(parsed.error.issues)}`),
        status: "completed",
        transcript,
        images,
      };
    }

    if (turnResult.toolCalls.length === 0) {
      messages.push({
        role: "user",
        text: "Continue exploring using the available tools, or call report_exploration_findings if you are done.",
      });
      continue;
    }

    for (const call of turnResult.toolCalls) {
      transcript.push({ turn, role: "assistant", toolName: call.name, toolInput: call.input, timestamp: new Date().toISOString() });

      try {
        const { text, images: callImages, isError } = await mcpSession.callTool(call.name, call.input);
        transcript.push({ turn, role: "tool", toolName: call.name, toolOutputSummary: text.slice(0, 4000), timestamp: new Date().toISOString() });
        for (const img of callImages) {
          images.push({ turn, toolName: call.name, mimeType: img.mimeType, base64: img.base64 });
        }
        messages.push({ role: "tool", toolCallId: call.id, toolResultText: text, toolIsError: isError });
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        transcript.push({ turn, role: "tool", toolName: call.name, toolOutputSummary: `ERROR: ${errorText}`, timestamp: new Date().toISOString() });
        messages.push({ role: "tool", toolCallId: call.id, toolResultText: `ERROR: ${errorText}`, toolIsError: true });
      }
    }
  }

  return { findings: timeoutFindings(`Turn cap (${MAX_TURNS}) reached without a report_exploration_findings call.`), status: "timeout", transcript, images };
}
