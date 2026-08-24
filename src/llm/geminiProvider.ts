import type { LlmProvider } from "./types.js";
import { createOpenAiProvider } from "./openaiProvider.js";

// Gemini exposes an OpenAI-compatible chat completions endpoint, so we reuse
// the OpenAI provider wholesale rather than writing a second client against
// Google's native SDK. Confirmed to support `tools` + `tool_choice: "auto"`;
// forced tool_choice (a specific function name), which the executor relies
// on for its last-turn termination guarantee, follows the same OpenAI-wire
// shape but hasn't been exercised against a real Gemini key here - worth a
// quick check once real runs happen.
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export function createGeminiProvider(apiKey: string, model: string): LlmProvider {
  return createOpenAiProvider(apiKey, model, { baseURL: GEMINI_BASE_URL, providerName: "gemini" });
}
