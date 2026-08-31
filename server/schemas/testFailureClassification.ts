import { z } from "zod";
import { DefectClassSchema, EvidenceKindSchema } from "../../src/schemas/classification.js";

export const TestFailureClassificationSchema = z.object({
  classification: DefectClassSchema,
  confidence: z.number().min(0).max(1),
  evidenceKind: EvidenceKindSchema,
  evidence: z.array(z.string()).min(1),
  reasoning: z.string().min(1),
  suggestedFix: z.string().optional(),
});
export type TestFailureClassification = z.infer<typeof TestFailureClassificationSchema>;
