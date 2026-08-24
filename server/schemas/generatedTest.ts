import { z } from "zod";

export const GeneratedTestFileSchema = z.object({
  code: z.string().min(1),
  tests: z.array(z.object({ scenarioId: z.string(), testTitle: z.string() })).min(1),
});
export type GeneratedTestFile = z.infer<typeof GeneratedTestFileSchema>;
