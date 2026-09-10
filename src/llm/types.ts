export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /**
   * Opaque provider-specific extra fields attached to this tool call (e.g.
   * Gemini's `extra_content.google.thought_signature` on thinking models,
   * required to round-trip verbatim on the next turn or Gemini rejects the
   * request with a 400). Providers that don't need this leave it undefined;
   * it's carried through ChatMessage.toolCalls unmodified by the executor.
   */
  providerExtra?: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  text?: string;
  toolCalls?: ToolCall[];
  /** Only present on role:"tool" messages - the result of a prior tool call. */
  toolCallId?: string;
  toolResultText?: string;
  toolIsError?: boolean;
}

export interface ChatTurnResult {
  text?: string;
  toolCalls: ToolCall[];
  stopReason: "tool_use" | "end_turn" | "max_tokens" | "other";
}

/** Force the model's next reply to be exactly this one tool call. */
export interface ForcedTool {
  name: string;
}

export interface LlmProvider {
  readonly name: string;
  /**
   * Runs one chat turn. `tools` is the full tool list (MCP-derived browser
   * tools plus the synthetic local `report_scenario_result` tool). Pass
   * `forceTool` to require the model call that exact tool on this turn -
   * used on the last allowed turn before the executor's turn cap so a run
   * ends with a parseable verdict instead of a bare timeout.
   */
  chat(messages: ChatMessage[], tools: ToolDef[], forceTool?: ForcedTool): Promise<ChatTurnResult>;
}
