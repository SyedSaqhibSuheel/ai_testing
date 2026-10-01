import { z } from "zod";

// For each given scenario: the literal, live-verified sequence of UI actions
// needed to reach its precondition (e.g. search for and select a customer
// before a customer-detail assertion), or an explicit admission that no such
// path exists - distinguishing "nobody wrote the setup steps" from "this
// state genuinely can't be reached by clicking around the app."
export const ScenarioPathSchema = z.object({
  scenarioTitle: z.string(),
  reachable: z.boolean(),
  steps: z
    .array(
      z.object({
        action: z.string(),
        testId: z.string().optional(),
        route: z.string().optional(),
        inputValue: z.string().optional(),
      })
    )
    .default([]),
  unreachableReason: z.string().optional(),
});
export type ScenarioPath = z.infer<typeof ScenarioPathSchema>;

export const ExplorationFindingsSchema = z.object({
  summary: z.string().min(1),
  discoveredRoutes: z.array(z.string()).default([]),
  discoveredTestIds: z.array(z.object({ testId: z.string(), component: z.string().optional() })).default([]),
  discoveredFlows: z.array(z.string()).default([]),
  crossReferenceNotes: z.array(z.string()).default([]),
  scenarioPaths: z.array(ScenarioPathSchema).default([]),
});
export type ExplorationFindings = z.infer<typeof ExplorationFindingsSchema>;
