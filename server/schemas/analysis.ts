import { z } from "zod";

export const DraftScenarioSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  scenarioType: z.enum(["positive", "negative", "edge_case"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  riskLevel: z.enum(["low", "medium", "high"]),
  preconditions: z.array(z.string()).default([]),
  draftSteps: z.array(z.string()).min(1),
  expectedResult: z.string().min(1),
  aiConfidence: z.number().min(0).max(1),
});
export type DraftScenario = z.infer<typeof DraftScenarioSchema>;

export const IntelligenceAnalysisSchema = z.object({
  functionalRequirements: z.array(z.object({ description: z.string() })).min(1),
  userRoles: z.array(z.string()).min(1),
  validationRules: z.array(z.string()).default([]),
  riskAreas: z.array(z.object({ area: z.string(), reason: z.string() })).default([]),
  suggestedCoverage: z.array(z.string()).default([]),
  scenarios: z.array(DraftScenarioSchema).min(1),
});
export type IntelligenceAnalysis = z.infer<typeof IntelligenceAnalysisSchema>;
