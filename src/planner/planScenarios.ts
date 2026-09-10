import type { LlmProvider } from "../llm/types.js";
import type { RelevantContext } from "../context/selectRelevantContext.js";
import { TestPlanSchema, type TestPlan } from "../schemas/testPlan.js";
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from "./prompts.js";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate);
}

export async function planScenarios(
  provider: LlmProvider,
  requirement: string,
  context: RelevantContext
): Promise<TestPlan> {
  const system = buildPlannerSystemPrompt();
  const user = buildPlannerUserPrompt(requirement, context);

  const attempt = async (extra?: string): Promise<TestPlan> => {
    const result = await provider.chat(
      [
        { role: "system", text: system },
        { role: "user", text: extra ? `${user}\n\n${extra}` : user },
      ],
      []
    );

    const parsed = TestPlanSchema.safeParse(extractJson(result.text ?? ""));
    if (!parsed.success) {
      throw new Error(`Planner output failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    }
    return parsed.data;
  };

  try {
    return await attempt();
  } catch (firstError) {
    // One retry with the validation error fed back - real models correct
    // themselves reliably given the exact zod error; a second failure is
    // treated as fatal rather than looping indefinitely.
    return await attempt(
      `Your previous response was invalid: ${(firstError as Error).message}. Return ONLY the corrected JSON object.`
    );
  }
}
