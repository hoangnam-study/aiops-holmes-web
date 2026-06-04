import { describe, expect, it } from "vitest";
import { drainSseBuffer, formatSse, parseSseFrame } from "../utils/sse.js";

describe("SSE utilities", () => {
  it("parses Holmes-style JSON events", () => {
    const parsed = parseSseFrame('event: ai_message\ndata: {"content":"hello"}');
    expect(parsed).toEqual({
      event: "ai_message",
      data: { content: "hello" },
      rawData: '{"content":"hello"}'
    });
  });

  it("drains complete frames and preserves partial buffers", () => {
    const input = `${formatSse("token_count", { total: 3 })}event: ai_message\ndata: {"content":"half"}`;
    const drained = drainSseBuffer(input);
    expect(drained.events).toHaveLength(1);
    expect(drained.events[0]?.event).toBe("token_count");
    expect(drained.rest).toContain("ai_message");
  });
});
