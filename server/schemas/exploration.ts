import { z } from "zod";

// For each given scenario: the literal, live-verified sequence of UI actions
// needed to reach its precondition (e.g. search for and select a customer
// before a customer-detail assertion), or an explicit admission that no such
// path exists - distinguishing "nobody wrote the setup steps" from "this
// state genuinely can't be reached by clicking around the app."
// When a scenario's final state is completed by something outside the
// browser (another app/device, a webhook, a backend job) rather than any
// click in this session, the real network request(s) the UI itself fires to
// start/poll for that completion - captured from the live browser's own
// network log (browser_network_requests), not guessed. This is what lets
// grounding/generation deterministically simulate the external actor's
// response via page.route() instead of giving up on the scenario entirely.
export const ExternalCompletionSchema = z.object({
  triggerRequest: z.object({ method: z.string(), url: z.string() }).optional(),
  pollingRequest: z.object({ method: z.string(), url: z.string() }).optional(),
  note: z.string(),
});
export type ExternalCompletion = z.infer<typeof ExternalCompletionSchema>;

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
  externalCompletion: ExternalCompletionSchema.optional(),
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
