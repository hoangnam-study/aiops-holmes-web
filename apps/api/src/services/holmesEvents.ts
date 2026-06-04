// Helpers for interpreting Holmes SSE events. Holmes versions differ in the
// event names and field names they use for streamed tokens and in whether they
// return conversation_history, so these stay deliberately tolerant.

const STREAM_TEXT_EVENTS = new Set([
  "ai_message",
  "ai_message_chunk",
  "token",
  "text",
  "message"
]);

const STREAM_TEXT_FIELDS = ["content", "delta", "text", "message", "token", "value"] as const;

/**
 * Pull streamed assistant text out of a Holmes SSE event payload. Returns "" for
 * non-text events (tool calls, status, etc.) so callers can blindly concatenate.
 */
export function extractStreamedText(eventType: string, payload: Record<string, unknown>): string {
  if (!STREAM_TEXT_EVENTS.has(eventType)) return "";
  for (const field of STREAM_TEXT_FIELDS) {
    const value = payload[field];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

/**
 * Decide the conversation_history to persist for a thread. Holmes returns the
 * full history on ai_answer_end in most versions; when it doesn't, fall back to
 * appending this turn so follow-up questions keep their context.
 */
export function mergeConversationHistory(
  existing: Record<string, unknown>[],
  holmesHistory: Record<string, unknown>[] | undefined,
  ask: string,
  answer: string
): Record<string, unknown>[] {
  if (Array.isArray(holmesHistory) && holmesHistory.length > 0) return holmesHistory;
  const next = [...existing];
  if (ask.trim()) next.push({ role: "user", content: ask });
  if (answer.trim()) next.push({ role: "assistant", content: answer });
  return next;
}
