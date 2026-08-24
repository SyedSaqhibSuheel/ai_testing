import { z } from "zod";

export const ScenarioStatusSchema = z.enum(["PASS", "FAIL", "INCONCLUSIVE", "TIMEOUT"]);
export type ScenarioStatus = z.infer<typeof ScenarioStatusSchema>;

export const NetworkLogEntrySchema = z.object({
  method: z.string(),
  url: z.string(),
  status: z.number().int().optional(),
  ok: z.boolean().optional(),
  bodySnippet: z.string().optional(),
});
export type NetworkLogEntry = z.infer<typeof NetworkLogEntrySchema>;

export const TranscriptTurnSchema = z.object({
  turn: z.number().int().nonnegative(),
  role: z.enum(["assistant", "tool"]),
  toolName: z.string().optional(),
  toolInput: z.unknown().optional(),
  toolOutputSummary: z.string().optional(),
  text: z.string().optional(),
  timestamp: z.string(),
});
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

// This is the shape of the synthetic `report_scenario_result` tool call
// arguments - the ONLY way the executor loop is allowed to terminate on its
// own (see src/mcp/toolSchemaBridge.ts).
export const ScenarioResultSchema = z.object({
  scenarioId: z.string(),
  status: ScenarioStatusSchema,
  summary: z.string().min(1),
  stepOutcomes: z.array(
    z.object({
      stepIndex: z.number().int().nonnegative(),
      passed: z.boolean(),
      observation: z.string(),
    })
  ),
  failingStepIndex: z.number().int().nonnegative().optional(),
  networkLog: z.array(NetworkLogEntrySchema).default([]),
  finalSnapshotText: z.string().optional(),
});
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;

export const ScenarioRunSchema = z.object({
  scenario: z.unknown(),
  result: ScenarioResultSchema,
  transcript: z.array(TranscriptTurnSchema),
  screenshotFiles: z.array(z.string()).default([]),
  startedAt: z.string(),
  finishedAt: z.string(),
});
export type ScenarioRun = z.infer<typeof ScenarioRunSchema>;
