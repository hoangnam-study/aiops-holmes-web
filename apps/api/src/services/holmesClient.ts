import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { drainSseBuffer, type ParsedSseEvent } from "../utils/sse.js";
import { extractStreamedText } from "./holmesEvents.js";
import { env } from "../config/env.js";

export interface HolmesConnection {
  baseUrl: string;
  apiKey?: string | null;
  defaultModel: string;
  verifySsl?: boolean;
  streamIdleTimeoutMs?: number;
}

export interface HolmesChatRequest {
  ask: string;
  model?: string | null;
  stream?: boolean;
  conversation_history?: Record<string, unknown>[];
  additional_system_prompt?: string;
  behavior_controls?: Record<string, boolean>;
  enable_tool_approval?: boolean;
  tool_decisions?: unknown[];
  frontend_tools?: unknown[];
  frontend_tool_results?: unknown[];
  request_source?: string;
  source_ref?: string;
  conversation_id?: string;
  conversation_source?: string;
  meta?: Record<string, unknown>;
}

export interface HolmesStatus {
  healthz: "ok" | "error";
  readyz: "ok" | "error";
  model?: unknown;
  errors: string[];
}

export interface HolmesCompletion {
  analysis: string;
  metadata?: Record<string, unknown>;
  conversation_history?: Record<string, unknown>[];
  tool_calls: Record<string, unknown>[];
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function timeoutMessage(timeoutMs: number) {
  return `Holmes did not send any stream data within ${Math.ceil(timeoutMs / 1000)} seconds. Check Holmes logs, model availability, or increase HOLMES_STREAM_IDLE_TIMEOUT_MS.`;
}

/**
 * Normalize the various shapes Holmes `/api/model` can return into a flat list
 * of model names. Known shape is `{ model_name: [...] }`, but tolerate plain
 * arrays/strings and alternate keys so the picker keeps working across versions.
 */
export function normalizeModelList(raw: unknown): string[] {
  const flatten = (value: unknown): string[] => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      // The deployed server returns model_name as a JSON-encoded array string,
      // e.g. "[\"cloud-escalate\"]" — unwrap it before treating it as a name.
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return flatten(parsed);
        } catch {
          // not JSON — fall through and treat as a literal name
        }
      }
      return trimmed ? [trimmed] : [];
    }
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
    return [];
  };

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.model_name ?? obj.models ?? obj.model;
    return [...new Set(flatten(candidate))];
  }
  return [...new Set(flatten(raw))];
}

export class HolmesClient {
  private connection: HolmesConnection;
  private insecureDispatcher?: Agent;

  constructor(connection: HolmesConnection) {
    this.connection = connection;
  }

  private headers(extra?: HeadersInit) {
    const headers = new Headers(extra);
    if (this.connection.apiKey) headers.set("Authorization", `Bearer ${this.connection.apiKey}`);
    return headers;
  }

  private fetch(url: string, init: RequestInit): Promise<Response> {
    if (this.connection.verifySsl !== false || !this.connection.baseUrl.startsWith("https://")) {
      return fetch(url, init);
    }
    this.insecureDispatcher ??= new Agent({ connect: { rejectUnauthorized: false } });
    return undiciFetch(url, { ...(init as UndiciRequestInit), dispatcher: this.insecureDispatcher }) as unknown as Promise<Response>;
  }

  async status(): Promise<HolmesStatus> {
    const errors: string[] = [];
    const check = async (path: string) => {
      try {
        const response = await this.fetch(
          joinUrl(this.connection.baseUrl, path),
          {
            headers: this.headers(),
            signal: AbortSignal.timeout(6000)
          }
        );
        if (!response.ok) throw new Error(`${path} returned ${response.status}`);
        return "ok" as const;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        return "error" as const;
      }
    };

    let model: unknown;
    try {
      const response = await this.fetch(
        joinUrl(this.connection.baseUrl, "/api/model"),
        {
          headers: this.headers(),
          signal: AbortSignal.timeout(6000)
        }
      );
      if (!response.ok) throw new Error(`/api/model returned ${response.status}`);
      model = await response.json().catch(() => response.text());
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      healthz: await check("/healthz"),
      readyz: await check("/readyz"),
      model,
      errors
    };
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetch(joinUrl(this.connection.baseUrl, "/api/model"), {
      headers: this.headers(),
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`/api/model returned ${response.status}`);
    const raw = await response.json().catch(() => null);
    return normalizeModelList(raw);
  }

  async chat(payload: HolmesChatRequest) {
    const response = await this.fetch(
      joinUrl(this.connection.baseUrl, "/api/chat"),
      {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          model: payload.model || this.connection.defaultModel,
          stream: false,
          ...payload
        }),
        signal: AbortSignal.timeout(300_000)
      }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Holmes /api/chat returned ${response.status}: ${text}`);
    }
    return response.json();
  }

  /**
   * Run a non-interactive Holmes investigation to completion over the STREAMING
   * endpoint and return the final answer, shaped like the blocking `chat()`
   * response (`analysis`/`metadata`/`conversation_history`/`tool_calls`).
   *
   * The deployed Holmes sits behind a gateway that 504s long blocking `/api/chat`
   * calls and 500s when the model returns an empty completion. Streaming keeps the
   * connection alive (idle-timeout resets per event) and tolerates empty output,
   * so all background flows (auto-RCA, scheduled prompts, health checks, runbooks,
   * bot, data-source verify) use this instead of `chat()`.
   */
  async chatToCompletion(payload: HolmesChatRequest, signal?: AbortSignal): Promise<HolmesCompletion> {
    let partial = "";
    let final = "";
    let metadata: Record<string, unknown> | undefined;
    let conversationHistory: Record<string, unknown>[] | undefined;
    let toolCalls: Record<string, unknown>[] | undefined;
    let errorMessage: string | undefined;

    await this.streamChat(
      payload,
      () => {},
      (event) => {
        const data =
          typeof event.data === "object" && event.data !== null
            ? (event.data as Record<string, unknown>)
            : { value: event.data };
        partial += extractStreamedText(event.event, data);
        if (event.event === "ai_answer_end") {
          final = String(data.analysis ?? data.content ?? "");
          metadata = data.metadata as Record<string, unknown> | undefined;
          conversationHistory = data.conversation_history as Record<string, unknown>[] | undefined;
          if (Array.isArray(data.tool_calls)) toolCalls = data.tool_calls as Record<string, unknown>[];
        }
        if (event.event === "error") {
          errorMessage = String(data.msg ?? data.description ?? "Holmes returned an error");
        }
      },
      signal
    );

    if (errorMessage) throw new Error(errorMessage);
    return {
      analysis: final || partial,
      metadata,
      conversation_history: conversationHistory,
      tool_calls: toolCalls ?? []
    };
  }

  async streamChat(
    payload: HolmesChatRequest,
    onRawChunk: (chunk: string) => void,
    onEvent: (event: ParsedSseEvent) => Promise<void> | void,
    signal?: AbortSignal
  ) {
    const idleTimeoutMs = this.connection.streamIdleTimeoutMs ?? env.HOLMES_STREAM_IDLE_TIMEOUT_MS;
    const requestController = new AbortController();
    let timedOut = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const abortFromCaller = () => requestController.abort(signal?.reason);
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        timedOut = true;
        requestController.abort(new Error(timeoutMessage(idleTimeoutMs)));
      }, idleTimeoutMs);
      idleTimer.unref?.();
    };

    if (signal) {
      if (signal.aborted) abortFromCaller();
      else signal.addEventListener("abort", abortFromCaller, { once: true });
    }
    resetIdleTimer();

    try {
      const response = await this.fetch(
        joinUrl(this.connection.baseUrl, "/api/chat"),
        {
          method: "POST",
          headers: this.headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            model: payload.model || this.connection.defaultModel,
            stream: true,
            ...payload
          }),
          signal: requestController.signal
        }
      );

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        throw new Error(`Holmes /api/chat stream returned ${response.status}: ${text}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetIdleTimer();
        const chunk = decoder.decode(value, { stream: true });
        onRawChunk(chunk);
        buffer += chunk;
        const drained = drainSseBuffer(buffer);
        buffer = drained.rest;
        for (const event of drained.events) {
          await onEvent(event);
        }
      }

      if (buffer.trim()) {
        const drained = drainSseBuffer(`${buffer}\n\n`);
        for (const event of drained.events) {
          await onEvent(event);
        }
      }
    } catch (error) {
      if (timedOut) throw new Error(timeoutMessage(idleTimeoutMs));
      throw error;
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
