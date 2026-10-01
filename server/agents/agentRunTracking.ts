import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { agentRuns, type AgentType } from "../db/schema.js";

// Single choke point for every agent's lifecycle - every write here is also
// where SSE broadcasting hooks in later, so status changes are visible to
// the dashboard in real time without agents knowing anything about SSE.
export type AgentRunListener = (runId: string) => void | Promise<void>;
let listener: AgentRunListener | null = null;
export function onAgentRunChange(fn: AgentRunListener): void {
  listener = fn;
}
function notify(runId: string): void {
  // Fire-and-forget: this is just the SSE broadcast side-effect, it must
  // never block or fail the agent flow that triggered it.
  void listener?.(runId);
}

export interface StartAgentRunInput {
  agentType: AgentType;
  requirementId: string;
  scenarioId?: string;
  input: unknown;
  parentRunId?: string;
}

export async function startAgentRun(db: Db, input: StartAgentRunInput): Promise<string> {
  const [row] = await db
    .insert(agentRuns)
    .values({
      agentType: input.agentType,
      requirementId: input.requirementId,
      scenarioId: input.scenarioId,
      status: "running",
      currentTask: "Requirement received",
      input: input.input,
      parentRunId: input.parentRunId,
    })
    .returning({ id: agentRuns.id });
  notify(row.id);
  return row.id;
}

export async function updateAgentRunTask(db: Db, runId: string, currentTask: string): Promise<void> {
  await db.update(agentRuns).set({ currentTask }).where(eq(agentRuns.id, runId));
  notify(runId);
}

export async function completeAgentRun(db: Db, runId: string, output: unknown): Promise<void> {
  await db
    .update(agentRuns)
    .set({ status: "completed", currentTask: "Completed", output, finishedAt: new Date() })
    .where(eq(agentRuns.id, runId));
  notify(runId);
}

export async function failAgentRun(db: Db, runId: string, errorMessage: string): Promise<void> {
  await db
    .update(agentRuns)
    .set({ status: "failed", currentTask: "Failed", errorMessage, finishedAt: new Date() })
    .where(eq(agentRuns.id, runId));
  notify(runId);
}

export async function incrementRetryCount(db: Db, runId: string): Promise<void> {
  const [row] = await db.select({ retryCount: agentRuns.retryCount }).from(agentRuns).where(eq(agentRuns.id, runId));
  await db.update(agentRuns).set({ retryCount: (row?.retryCount ?? 0) + 1 }).where(eq(agentRuns.id, runId));
  notify(runId);
}
