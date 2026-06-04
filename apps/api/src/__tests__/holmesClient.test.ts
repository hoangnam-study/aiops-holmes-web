import { afterEach, describe, expect, it, vi } from "vitest";
import { HolmesClient } from "../services/holmesClient.js";

describe("HolmesClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams Holmes SSE events and parses them while relaying raw chunks", async () => {
    const body = [
      'event: ai_message\ndata: {"content":"hello "}\n\n',
      'event: ai_answer_end\ndata: {"analysis":"hello world","conversation_history":[{"role":"assistant","content":"hello world"}]}\n\n'
    ].join("");
    const chunks = [body.slice(0, 32), body.slice(32)];
    const encoder = new TextEncoder();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
              controller.close();
            }
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream" } }
        )
      )
    );

    const raw: string[] = [];
    const events: string[] = [];
    await new HolmesClient({
      baseUrl: "http://holmes.local",
      defaultModel: "local-triage"
    }).streamChat(
      { ask: "hello" },
      (chunk) => raw.push(chunk),
      (event) => events.push(event.event)
    );

    expect(raw.join("")).toBe(body);
    expect(events).toEqual(["ai_message", "ai_answer_end"]);
    expect(fetch).toHaveBeenCalledWith(
      "http://holmes.local/api/chat",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"stream":true')
      })
    );

  });

  it("fails when Holmes does not emit stream data before the idle timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        })
      )
    );

    await expect(
      new HolmesClient({
        baseUrl: "http://holmes.local",
        defaultModel: "local-triage",
        streamIdleTimeoutMs: 10
      }).streamChat(
        { ask: "hello" },
        () => undefined,
        () => undefined
      )
    ).rejects.toThrow("Holmes did not send any stream data within 1 seconds");
  });
});
