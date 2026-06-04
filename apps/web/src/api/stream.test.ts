import { describe, expect, it } from "vitest";
import { extractStreamedText, parseFrame } from "./stream";

describe("frontend SSE parser", () => {
  it("parses named JSON SSE frames", () => {
    expect(parseFrame('event: ai_message\ndata: {"content":"chunk"}')).toEqual({
      event: "ai_message",
      data: { content: "chunk" }
    });
  });

  it("keeps text payloads when data is not JSON", () => {
    expect(parseFrame("event: error\ndata: plain error")).toEqual({
      event: "error",
      data: { value: "plain error" }
    });
  });

  it("ignores SSE comment heartbeats", () => {
    expect(parseFrame(": keepalive")).toBeNull();
  });
});

describe("extractStreamedText", () => {
  it("pulls token text from assorted event/field shapes", () => {
    expect(extractStreamedText({ event: "ai_message", data: { content: "a" } })).toBe("a");
    expect(extractStreamedText({ event: "token", data: { delta: "b" } })).toBe("b");
    expect(extractStreamedText({ event: "text", data: { text: "c" } })).toBe("c");
  });

  it("returns empty for non-text events", () => {
    expect(extractStreamedText({ event: "ai_answer_end", data: { analysis: "x" } })).toBe("");
    expect(extractStreamedText({ event: "start_tool_calling", data: { tool: "kubectl" } })).toBe("");
  });
});
