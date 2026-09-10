import type { Config } from "../config.js";
import type { LlmProvider } from "./types.js";
import { createAnthropicProvider } from "./anthropicProvider.js";
import { createOpenAiProvider } from "./openaiProvider.js";
import { createGeminiProvider } from "./geminiProvider.js";
import { createMockProvider } from "./mockProvider.js";

export function getProvider(config: Config): LlmProvider {
  switch (config.llmProvider) {
    case "anthropic":
      return createAnthropicProvider(config.anthropicApiKey!, config.anthropicModel);
    case "openai":
      return createOpenAiProvider(config.openaiApiKey!, config.openaiModel);
    case "gemini":
      return createGeminiProvider(config.geminiApiKey!, config.geminiModel);
    case "mock":
      return createMockProvider(config.appBaseUrl);
  }
}

export type { ChatMessage, ChatTurnResult, ForcedTool, LlmProvider, ToolCall, ToolDef } from "./types.js";
