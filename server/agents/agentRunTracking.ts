import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { agentRuns, type AgentType } from "../db/schema.js";

// Single choke point for every agent's lifecycle - every write here is also
// where SSE broadcasting hooks in later, so status changes are visible to
// the dashboard in real time without agents knowing anything about SSE.
export type AgentRunListener = (runId: string) => void;
let listener: AgentRunListener | null = null;
export function onAgentRunChange(fn: AgentRunListener): void {
  listener = fn;
}
function notify(runId: string): void {
  listener?.(runId);
}

export interface StartAgentRunInput {
  agentType: AgentType;
  requirementId: string;
  scenarioId?: string;
  input: unknown;
  parentRunId?: string;
}

export function startAgentRun(db: Db, input: StartAgentRunInput): string {
  const row = db
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
    .returning({ id: agentRuns.id })
    .get();
  notify(row.id);
  return row.id;
}

export function updateAgentRunTask(db: Db, runId: string, currentTask: string): void {
  db.update(agentRuns).set({ currentTask }).where(eq(agentRuns.id, runId)).run();
  notify(runId);
}

export function completeAgentRun(db: Db, runId: string, output: unknown): void {
  db.update(agentRuns)
    .set({ status: "completed", currentTask: "Completed", output, finishedAt: new Date() })
    .where(eq(agentRuns.id, runId))
    .run();
  notify(runId);
}

export function failAgentRun(db: Db, runId: string, errorMessage: string): void {
  db.update(agentRuns)
    .set({ status: "failed", currentTask: "Failed", errorMessage, finishedAt: new Date() })
    .where(eq(agentRuns.id, runId))
    .run();
  notify(runId);
}

export function incrementRetryCount(db: Db, runId: string): void {
  const row = db.select({ retryCount: agentRuns.retryCount }).from(agentRuns).where(eq(agentRuns.id, runId)).get();
  db.update(agentRuns).set({ retryCount: (row?.retryCount ?? 0) + 1 }).where(eq(agentRuns.id, runId)).run();
  notify(runId);
}
