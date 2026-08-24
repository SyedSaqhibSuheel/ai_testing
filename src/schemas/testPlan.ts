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
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const TestPlanSchema = z.object({
  requirement: z.string().min(1),
  generatedAt: z.string(),
  scenarios: z.array(ScenarioSchema).min(1),
});
export type TestPlan = z.infer<typeof TestPlanSchema>;
