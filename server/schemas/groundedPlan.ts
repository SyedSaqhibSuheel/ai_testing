import { z } from "zod";
import { ScenarioSchema } from "../../src/schemas/testPlan.js";

export const GroundedPlansSchema = z.object({
  plans: z.array(ScenarioSchema).min(1),
});
export type GroundedPlans = z.infer<typeof GroundedPlansSchema>;
