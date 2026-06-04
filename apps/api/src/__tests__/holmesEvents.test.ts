import { describe, expect, it } from "vitest";
import { extractStreamedText, mergeConversationHistory } from "../services/holmesEvents.js";
import { normalizeModelList } from "../services/holmesClient.js";

describe("extractStreamedText", () => {
  it("reads content from ai_message", () => {
    expect(extractStreamedText("ai_message", { content: "hello" })).toBe("hello");
  });

  it("tolerates alternate event and field names", () => {
    expect(extractStreamedText("token", { delta: "x" })).toBe("x");
    expect(extractStreamedText("text", { text: "y" })).toBe("y");
    expect(extractStreamedText("ai_message_chunk", { message: "z" })).toBe("z");
  });

  it("ignores non-text events and empty payloads", () => {
    expect(extractStreamedText("ai_answer_end", { analysis: "done" })).toBe("");
    expect(extractStreamedText("start_tool_calling", { tool: "kubectl" })).toBe("");
    expect(extractStreamedText("ai_message", { content: "" })).toBe("");
  });
});

describe("mergeConversationHistory", () => {
  it("prefers Holmes-returned history when present", () => {
    const holmes = [{ role: "assistant", content: "from holmes" }];
    expect(mergeConversationHistory([], holmes, "ask", "answer")).toBe(holmes);
  });

  it("appends the turn when Holmes omits history", () => {
    const existing = [{ role: "user", content: "earlier" }];
    expect(mergeConversationHistory(existing, undefined, "what now", "the answer")).toEqual([
      { role: "user", content: "earlier" },
      { role: "user", content: "what now" },
      { role: "assistant", content: "the answer" }
    ]);
  });

  it("appends the turn when Holmes returns an empty history array", () => {
    expect(mergeConversationHistory([], [], "q", "a")).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "a" }
    ]);
  });
});

describe("normalizeModelList", () => {
  it("reads the known model_name shape", () => {
    expect(normalizeModelList({ model_name: ["gpt-4o", "claude"] })).toEqual(["gpt-4o", "claude"]);
  });

  it("tolerates arrays, strings, and alternate keys", () => {
    expect(normalizeModelList(["a", "b"])).toEqual(["a", "b"]);
    expect(normalizeModelList("solo")).toEqual(["solo"]);
    expect(normalizeModelList({ models: ["m1"] })).toEqual(["m1"]);
  });

  it("unwraps the deployed server's JSON-string model_name", () => {
    // Real shape from the deployed Holmes: {"model_name":"[\"cloud-escalate\"]"}
    expect(normalizeModelList({ model_name: '["cloud-escalate"]' })).toEqual(["cloud-escalate"]);
  });

  it("dedupes and drops non-strings/empties", () => {
    expect(normalizeModelList({ model_name: ["a", "a", "", 3, null] })).toEqual(["a"]);
    expect(normalizeModelList(null)).toEqual([]);
  });
});
