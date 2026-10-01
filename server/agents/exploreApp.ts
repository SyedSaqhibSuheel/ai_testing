import type { LlmProvider, ChatMessage } from "../../src/llm/types.js";
import type { PlaywrightMcpSession } from "../../src/mcp/playwrightClient.js";
import { REPORT_EXPLORATION_TOOL, withReportExplorationTool } from "../../src/mcp/toolSchemaBridge.js";
import type { RelevantContext } from "../../src/context/selectRelevantContext.js";
import type { TranscriptTurn } from "../../src/schemas/scenarioResult.js";
import { ExplorationFindingsSchema, type ExplorationFindings } from "../schemas/exploration.js";
import { buildExploreSystemPrompt, buildExploreUserPrompt } from "./explorePrompts.js";

// Now drives real interaction per scenario (not just cataloguing) to find
// each one's live-reachable precondition path, so this needs closer to
// scenario execution's own 40-turn budget. The wall clock must still outlast
// withRateLimitRetry: a single free-tier 429 can wait ~4 x 22s, which alone
// used to exhaust a 120s budget and save an empty (routes/flows: none) run.
const MAX_TURNS = 40;
const WALL_CLOCK_TIMEOUT_MS = 420_000;

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
  return { summary: reason, discoveredRoutes: [], discoveredTestIds: [], discoveredFlows: [], crossReferenceNotes: [], scenarioPaths: [] };
}

// browser_snapshot is an accessibility tree - it never shows data-testid
// attributes, so testids the model "reports" are guesses (e.g. inventing
// input-username/button-sign-in for a login form that has none). Instead,
// read them straight off the DOM after each turn and treat that as the only
// source of truth for live testids.
const HARVEST_TESTIDS_FN =
  "() => 'TESTIDS@' + location.pathname + '::' + [...new Set([...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')))].join('|') + '::END'";
const HARVEST_RESULT_RE = /TESTIDS@(.*?)::(.*?)::END/;

async function harvestDomTestIds(mcpSession: PlaywrightMcpSession, into: Map<string, string>): Promise<boolean> {
  try {
    const { text, isError } = await mcpSession.callTool("browser_evaluate", { function: HARVEST_TESTIDS_FN });
    const match = !isError && text.match(HARVEST_RESULT_RE);
    if (!match) return false;
    const [, pathname, joined] = match;
    for (const testId of joined.split("|").filter(Boolean)) {
      if (!into.has(testId)) into.set(testId, pathname);
    }
    return true;
  } catch {
    return false;
  }
}

/** Replaces the model-reported testids with the ones actually found in the DOM. */
function reconcileTestIds(findings: ExplorationFindings, domTestIds: Map<string, string>, harvestSucceeded: boolean): ExplorationFindings {
  const reported = new Map(findings.discoveredTestIds.map((t) => [t.testId, t.component]));
  const unverified = [...reported.keys()].filter((t) => !domTestIds.has(t));
  const notes = [...findings.crossReferenceNotes];
  if (!harvestSucceeded && reported.size > 0) {
    notes.push(`Could not read data-testids from the live DOM - discarded ${reported.size} model-reported testid(s) as unverifiable.`);
  } else if (unverified.length > 0) {
    notes.push(`Discarded model-reported testid(s) not present in the live DOM: ${unverified.join(", ")}`);
  }
  return {
    ...findings,
    discoveredTestIds: [...domTestIds].map(([testId, pathname]) => ({ testId, component: reported.get(testId) ?? `page ${pathname}` })),
    crossReferenceNotes: notes,
  };
}

export async function exploreApp(
  provider: LlmProvider,
  mcpSession: PlaywrightMcpSession,
  requirementText: string,
  approvedScenarios: Array<{ title: string; preconditions: string[] }>,
  context: RelevantContext,
  appBaseUrl: string,
  login?: { username: string; password: string }
): Promise<ExploreAppOutput> {
  const tools = withReportExplorationTool(mcpSession.tools);
  const transcript: TranscriptTurn[] = [];
  const images: CapturedImage[] = [];

  const messages: ChatMessage[] = [
    { role: "system", text: buildExploreSystemPrompt(appBaseUrl, login) },
    { role: "user", text: buildExploreUserPrompt(requirementText, approvedScenarios, context) },
  ];

  const domTestIds = new Map<string, string>();
  let harvestSucceeded = false;
  const finish = (findings: ExplorationFindings, status: ExploreAppOutput["status"]): ExploreAppOutput => ({
    findings: reconcileTestIds(findings, domTestIds, harvestSucceeded),
    status,
    transcript,
    images,
  });

  const startedAt = Date.now();
  let turn = 0;

  while (turn < MAX_TURNS) {
    if (Date.now() - startedAt > WALL_CLOCK_TIMEOUT_MS) {
      return finish(timeoutFindings(`Wall-clock timeout after ${WALL_CLOCK_TIMEOUT_MS}ms.`), "timeout");
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
        return finish(parsed.data, "completed");
      }
      return finish(
        timeoutFindings(`Model's report_exploration_findings call did not match the expected schema: ${JSON.stringify(parsed.error.issues)}`),
        "completed"
      );
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

    if (await harvestDomTestIds(mcpSession, domTestIds)) harvestSucceeded = true;
  }

  return finish(timeoutFindings(`Turn cap (${MAX_TURNS}) reached without a report_exploration_findings call.`), "timeout");
}
