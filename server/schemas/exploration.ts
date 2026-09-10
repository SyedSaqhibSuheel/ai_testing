import { z } from "zod";

export const ExplorationFindingsSchema = z.object({
  summary: z.string().min(1),
  discoveredRoutes: z.array(z.string()).default([]),
  discoveredTestIds: z.array(z.object({ testId: z.string(), component: z.string().optional() })).default([]),
  discoveredFlows: z.array(z.string()).default([]),
  crossReferenceNotes: z.array(z.string()).default([]),
});
export type ExplorationFindings = z.infer<typeof ExplorationFindingsSchema>;
