import { z } from "zod";

export const TestStepSchema = z.object({
  index: z.number().int().nonnegative(),
  action: z.string().min(1),
  targetTestId: z.string().optional(),
  targetRoute: z.string().optional(),
  inputValue: z.string().optional(),
  notes: z.string().optional(),
});
export type TestStep = z.infer<typeof TestStepSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  requirementRef: z.string().min(1),
  preconditions: z.array(z.string()).default([]),
  steps: z.array(TestStepSchema).min(1),
  expectedBackendCalls: z
    .array(
      z.object({
        method: z.string(),
        path: z.string(),
        expectedStatus: z.number().int().optional(),
      })
    )
    .default([]),
  expectedUiOutcomes: z.array(z.string()).default([]),
  passCriteria: z.array(z.string()).min(1),
  // false when live exploration found no UI-reachable path to this
  // scenario's precondition (e.g. a state only a backend/websocket push can
  // cause, like a customer's own mobile app approving/denying) - the
  // Generator writes a test.skip(reason) instead of steps that would always
  // fail. true/absent means grounding found (or assumed, if ungrounded) a
  // real path and `steps` should be followed normally.
  groundable: z.boolean().default(true),
  ungroundableReason: z.string().optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const TestPlanSchema = z.object({
  requirement: z.string().min(1),
  generatedAt: z.string(),
  scenarios: z.array(ScenarioSchema).min(1),
});
export type TestPlan = z.infer<typeof TestPlanSchema>;
