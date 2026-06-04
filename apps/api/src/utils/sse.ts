export interface ParsedSseEvent {
  event: string;
  data: unknown;
  rawData: string;
}

export function parseSseFrame(frame: string): ParsedSseEvent | null {
  const lines = frame.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  const rawData = dataLines.join("\n");
  let data: unknown = rawData;
  try {
    data = JSON.parse(rawData);
  } catch {
    // Holmes emits JSON, but keep a text fallback for forward compatibility.
  }

  return { event, data, rawData };
}

export function drainSseBuffer(buffer: string) {
  const frames: ParsedSseEvent[] = [];
  let cursor = buffer;
  let boundary = cursor.search(/\r?\n\r?\n/);

  while (boundary >= 0) {
    const frame = cursor.slice(0, boundary);
    const match = cursor.slice(boundary).match(/^\r?\n\r?\n/);
    cursor = cursor.slice(boundary + (match?.[0].length ?? 2));
    const parsed = parseSseFrame(frame);
    if (parsed) frames.push(parsed);
    boundary = cursor.search(/\r?\n\r?\n/);
  }

  return { events: frames, rest: cursor };
}

export function formatSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
