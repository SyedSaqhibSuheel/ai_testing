import OpenAI from "openai";
import type {
  ChatMessage,
  ChatTurnResult,
  ForcedTool,
  LlmProvider,
  ToolCall,
  ToolDef,
} from "./types.js";
import { withRateLimitRetry } from "./retry.js";

function toOpenAiTools(tools: ToolDef[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

function toOpenAiMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      result.push({ role: "system", content: msg.text ?? "" });
    } else if (msg.role === "user") {
      result.push({ role: "user", content: msg.text ?? "" });
    } else if (msg.role === "assistant") {
      result.push({
        role: "assistant",
        content: msg.text ?? null,
        // `...call.providerExtra` re-attaches provider-specific extension
        // fields verbatim (e.g. Gemini's extra_content.google.thought_signature
        // on thinking models - Gemini's OpenAI-compat endpoint 400s on the
        // next turn without it, since the plain OpenAI schema has no field
        // for it). Harmless no-op for providers that never set providerExtra.
        tool_calls: (msg.toolCalls ?? []).map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.input) },
          ...call.providerExtra,
        })),
      });
    } else if (msg.role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: msg.toolCallId ?? "",
        content: msg.toolResultText ?? "",
      });
    }
  }

  return result;
}

export interface OpenAiCompatibleOptions {
  /** Override for providers exposing an OpenAI-compatible endpoint (e.g. Gemini). */
  baseURL?: string;
  /** Label used in logs/error messages - defaults to "openai". */
  providerName?: string;
}

export function createOpenAiProvider(
  apiKey: string,
  model: string,
  options: OpenAiCompatibleOptions = {}
): LlmProvider {
  const client = new OpenAI({ apiKey, baseURL: options.baseURL });

  return {
    name: options.providerName ?? "openai",
    async chat(messages, tools, forceTool?: ForcedTool): Promise<ChatTurnResult> {
      const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = forceTool
        ? { type: "function", function: { name: forceTool.name } }
        : "auto";

      const response = await withRateLimitRetry(() =>
        client.chat.completions.create({
          model,
          messages: toOpenAiMessages(messages),
          tools: toOpenAiTools(tools),
          tool_choice: toolChoice,
        })
      );

      const choice = response.choices[0];
      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? [])
        .filter((call): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => call.type === "function")
        .map((call) => {
          // `extra_content` (e.g. Gemini's thought_signature) isn't part of
          // the typed OpenAI schema but Gemini's compat endpoint sends it -
          // capture it opaquely so it can be replayed on the next turn.
          const extraContent = (call as unknown as { extra_content?: Record<string, unknown> }).extra_content;
          return {
            id: call.id,
            name: call.function.name,
            input: JSON.parse(call.function.arguments || "{}"),
            providerExtra: extraContent ? { extra_content: extraContent } : undefined,
          };
        });

      const stopReason =
        choice.finish_reason === "tool_calls"
          ? "tool_use"
          : choice.finish_reason === "stop"
            ? "end_turn"
            : choice.finish_reason === "length"
              ? "max_tokens"
              : "other";

      return { text: choice.message.content ?? undefined, toolCalls, stopReason };
    },
  };
}
