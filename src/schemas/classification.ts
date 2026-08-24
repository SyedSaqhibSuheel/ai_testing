import { z } from "zod";

// Checked in this fixed order by the classifier - see
// src/analyzer/classifyFailure.ts. ENVIRONMENT_ERROR is checked first because
// connection-refused/timeout failures carry no HTTP status and would
// otherwise get force-fit into REAL_DEFECT.
export const DefectClassSchema = z.enum([
  "ENVIRONMENT_ERROR",
  "TEST_SCRIPT_ERROR",
  "UI_LOCATOR_CHANGE",
  "REAL_DEFECT",
  "INCONCLUSIVE",
]);
export type DefectClass = z.infer<typeof DefectClassSchema>;

export const EvidenceKindSchema = z.enum([
  "HTTP_STATUS",
  "DOM_SNAPSHOT_DIFF",
  "STATIC_PLAN_VS_SCAN",
  "NARRATIVE_INFERENCE",
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const ClassificationResultSchema = z.object({
  scenarioId: z.string(),
  classification: DefectClassSchema,
  confidence: z.number().min(0).max(1),
  evidenceKind: EvidenceKindSchema,
  evidence: z.array(z.string()).min(1),
  reasoning: z.string().min(1),
  suggestedFix: z.string().optional(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
