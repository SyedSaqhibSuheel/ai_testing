import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  ChatTurnResult,
  ForcedTool,
  LlmProvider,
  ToolCall,
  ToolDef,
} from "./types.js";
import { withRateLimitRetry } from "./retry.js";

function toAnthropicTools(tools: ToolDef[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // handled separately as the `system` param

    if (msg.role === "user") {
      result.push({ role: "user", content: msg.text ?? "" });
      continue;
    }

    if (msg.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (msg.text) content.push({ type: "text", text: msg.text });
      for (const call of msg.toolCalls ?? []) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      result.push({ role: "assistant", content });
      continue;
    }

    if (msg.role === "tool") {
      result.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId ?? "",
            content: msg.toolResultText ?? "",
            is_error: msg.toolIsError ?? false,
          },
        ],
      });
    }
  }

  return result;
}

export function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    async chat(messages, tools, forceTool?: ForcedTool): Promise<ChatTurnResult> {
      const system = messages.find((m) => m.role === "system")?.text;

      const toolChoice: Anthropic.ToolChoice = forceTool
        ? { type: "tool", name: forceTool.name }
        : { type: "auto" };

      const response = await withRateLimitRetry(() =>
        client.messages.create({
          model,
          max_tokens: 4096,
          system,
          messages: toAnthropicMessages(messages),
          tools: toAnthropicTools(tools),
          tool_choice: toolChoice,
        })
      );

      const toolCalls: ToolCall[] = [];
      let text: string | undefined;

      for (const block of response.content) {
        if (block.type === "text") {
          text = (text ?? "") + block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
        }
      }

      const stopReason =
        response.stop_reason === "tool_use"
          ? "tool_use"
          : response.stop_reason === "end_turn"
            ? "end_turn"
            : response.stop_reason === "max_tokens"
              ? "max_tokens"
              : "other";

      return { text, toolCalls, stopReason };
    },
  };
}
