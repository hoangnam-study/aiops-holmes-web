import type { StreamEvent } from "../types/api";

// Mirror of the backend's holmesEvents extractor: tolerate the different event
// and field names Holmes versions use for streamed assistant tokens.
export const STREAM_TEXT_EVENTS = new Set([
  "ai_message",
  "ai_message_chunk",
  "token",
  "text",
  "message"
]);

const STREAM_TEXT_FIELDS = ["content", "delta", "text", "message", "token", "value"] as const;

export function extractStreamedText(event: StreamEvent): string {
  if (!STREAM_TEXT_EVENTS.has(event.event)) return "";
  for (const field of STREAM_TEXT_FIELDS) {
    const value = event.data[field];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

export function parseFrame(frame: string): StreamEvent | null {
  const lines = frame.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join("\n");
  let data: Record<string, unknown> = { value: raw };
  try {
    data = JSON.parse(raw);
  } catch {
    data = { value: raw };
  }
  return { event, data };
}

export async function streamPost(
  path: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Stream failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.search(/\r?\n\r?\n/);
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      const match = buffer.slice(boundary).match(/^\r?\n\r?\n/);
      buffer = buffer.slice(boundary + (match?.[0].length ?? 2));
      const parsed = parseFrame(frame);
      if (parsed) onEvent(parsed);
      boundary = buffer.search(/\r?\n\r?\n/);
    }
  }

  if (buffer.trim()) {
    const parsed = parseFrame(buffer);
    if (parsed) onEvent(parsed);
  }
}
