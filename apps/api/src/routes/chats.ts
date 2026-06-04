import { Router, type Response } from "express";
import { z } from "zod";
import { Types, type HydratedDocument } from "mongoose";
import { ChatThread, type ChatThreadDoc } from "../models/ChatThread.js";
import { ChatMessage, type ChatMessageDoc } from "../models/ChatMessage.js";
import { ChatEvent } from "../models/ChatEvent.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";
import { getHolmesConnection } from "../services/settingsService.js";
import { HolmesClient } from "../services/holmesClient.js";
import { buildAdditionalSystemPrompt } from "../services/knowledgeService.js";
import { extractStreamedText, mergeConversationHistory } from "../services/holmesEvents.js";
import { parsePrometheusGraph, type GraphData } from "../services/holmesGraphs.js";
import { formatSse } from "../utils/sse.js";

const router = Router();
const EMPTY_HOLMES_RESPONSE =
  "Holmes returned an empty response from the selected model. Retry the prompt; if it repeats, check Holmes/LiteLLM logs for completion_tokens: 0.";

const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");

const createThreadSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  model: z.string().min(1).optional(),
  visibility: z.enum(["private", "shared"]).optional()
});

const updateThreadSchema = createThreadSchema.partial().extend({
  archived: z.boolean().optional()
});

const messageSchema = z.object({
  ask: z.string().min(1).max(20_000),
  model: z.string().optional(),
  behaviorControls: z.record(z.string(), z.boolean()).optional(),
  enableToolApproval: z.boolean().optional(),
  toolDecisions: z.array(z.unknown()).optional(),
  frontendToolResults: z.array(z.unknown()).optional()
});

const approveSchema = z.object({
  toolDecisions: z.array(z.object({ toolCallId: z.string().min(1), approved: z.boolean() })).min(1),
  model: z.string().optional()
});

type ThreadDoc = HydratedDocument<ChatThreadDoc>;
type MessageDoc = HydratedDocument<ChatMessageDoc>;

function makeTitle(ask: string) {
  const trimmed = ask.replace(/\s+/g, " ").trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}...` : trimmed || "New chat";
}

interface StreamTurnOptions {
  req: AuthRequest;
  res: Response;
  thread: ThreadDoc;
  assistantMessage: MessageDoc;
  /** Omitted on a tool-approval continuation (no new user message is created). */
  userMessageId?: Types.ObjectId;
  ask: string;
  model?: string;
  /** History to seed Holmes with — thread history for a fresh turn, or the
   *  approval payload's history when continuing after a tool approval. */
  conversationHistory: Record<string, unknown>[];
  enableToolApproval?: boolean;
  toolDecisions?: unknown[];
}

/**
 * Run one Holmes streaming turn: relay the SSE bytes to the client, persist
 * every event, and resolve the terminal state (final answer, approval request,
 * or error) onto the assistant message + thread. Shared by the message-send and
 * tool-approval-continue endpoints so both behave identically.
 */
async function streamHolmesTurn(opts: StreamTurnOptions) {
  const { req, res, thread, assistantMessage, ask, conversationHistory } = opts;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();
  res.write(
    formatSse("chat_metadata", {
      threadId: String(thread._id),
      userMessageId: opts.userMessageId ? String(opts.userMessageId) : null,
      assistantMessageId: String(assistantMessage._id)
    })
  );
  const keepAlive = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": keepalive\n\n");
  }, 15_000);
  keepAlive.unref?.();

  const connection = await getHolmesConnection();
  const client = new HolmesClient(connection);
  const additionalSystemPrompt = await buildAdditionalSystemPrompt();

  let finalAnalysis = "";
  let finalMetadata: Record<string, unknown> | undefined;
  let finalConversationHistory: Record<string, unknown>[] | undefined;
  let partialAnalysis = "";
  const graphs: Record<string, GraphData> = {};
  let terminalEvent: "ai_answer_end" | "approval_required" | "error" | undefined;
  const abortController = new AbortController();
  req.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    await client.streamChat(
      {
        ask,
        model: opts.model || thread.model || connection.defaultModel,
        conversation_history: conversationHistory,
        additional_system_prompt: additionalSystemPrompt,
        enable_tool_approval: opts.enableToolApproval,
        tool_decisions: opts.toolDecisions,
        request_source: "freeform",
        conversation_id: String(thread._id),
        conversation_source: "chat_history"
      },
      (chunk) => {
        res.write(chunk);
      },
      async (event) => {
        const payload =
          typeof event.data === "object" && event.data !== null
            ? (event.data as Record<string, unknown>)
            : { value: event.data };
        await ChatEvent.create({
          threadId: thread._id,
          messageId: assistantMessage._id,
          eventType: event.event,
          payload
        });

        partialAnalysis += extractStreamedText(event.event, payload);
        if (event.event === "tool_calling_result") {
          const graph = parsePrometheusGraph(payload);
          if (graph) graphs[graph.toolCallId] = graph;
        }
        if (event.event === "ai_answer_end") {
          terminalEvent = "ai_answer_end";
          finalAnalysis = String(payload.analysis ?? payload.content ?? "");
          finalMetadata = payload.metadata as Record<string, unknown> | undefined;
          finalConversationHistory = payload.conversation_history as Record<string, unknown>[] | undefined;
        }
        if (event.event === "approval_required") {
          terminalEvent = "approval_required";
          assistantMessage.status = "awaiting_approval";
          assistantMessage.content = String(payload.analysis ?? payload.content ?? partialAnalysis ?? "");
          // Persist the whole payload — the continue endpoint reads
          // conversation_history + pending_approvals back out of it.
          assistantMessage.metadata = payload;
          await assistantMessage.save();
        }
        if (event.event === "error") {
          terminalEvent = "error";
          assistantMessage.status = "error";
          assistantMessage.content = String(payload.msg ?? payload.description ?? "Holmes returned an error");
          assistantMessage.metadata = payload;
          await assistantMessage.save();
        }
      },
      abortController.signal
    );

    if (terminalEvent === "ai_answer_end") {
      const answer = finalAnalysis || partialAnalysis;
      if (answer.trim()) {
        assistantMessage.status = "completed";
        assistantMessage.content = answer;
        assistantMessage.metadata = {
          ...(finalMetadata ?? {}),
          ...(Object.keys(graphs).length ? { graphs } : {})
        };
      } else {
        const emptyResponsePayload = {
          msg: EMPTY_HOLMES_RESPONSE,
          description: EMPTY_HOLMES_RESPONSE,
          success: false,
          upstreamEvent: "ai_answer_end",
          requestId: finalMetadata?.request_id
        };
        assistantMessage.status = "error";
        assistantMessage.content = EMPTY_HOLMES_RESPONSE;
        assistantMessage.metadata = { ...(finalMetadata ?? {}), emptyResponse: true };
        await ChatEvent.create({
          threadId: thread._id,
          messageId: assistantMessage._id,
          eventType: "error",
          payload: emptyResponsePayload
        });
        if (!res.writableEnded) res.write(formatSse("error", emptyResponsePayload));
      }
      await assistantMessage.save();
    }
    if (terminalEvent === "ai_answer_end") {
      const answer = (finalAnalysis || partialAnalysis).trim();
      // Keep multi-turn context even when Holmes omits conversation_history on
      // the stream; otherwise follow-up questions lose all prior turns.
      if (answer) {
        thread.conversationHistory = mergeConversationHistory(
          thread.conversationHistory,
          finalConversationHistory,
          ask,
          answer
        );
      } else if (finalConversationHistory) {
        thread.conversationHistory = finalConversationHistory;
      }
    } else if (finalConversationHistory) {
      thread.conversationHistory = finalConversationHistory;
    }
    thread.lastMessageAt = new Date();
    await thread.save();
    if (!res.writableEnded) res.end();
  } catch (error) {
    if (abortController.signal.aborted) {
      assistantMessage.status = partialAnalysis ? "completed" : "error";
      assistantMessage.content = partialAnalysis || "Request cancelled";
      assistantMessage.metadata = { cancelled: true };
      await assistantMessage.save();
      await ChatEvent.create({
        threadId: thread._id,
        messageId: assistantMessage._id,
        eventType: "cancelled",
        payload: { msg: "Request cancelled" }
      });
      if (!res.writableEnded) res.end();
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    assistantMessage.status = "error";
    assistantMessage.content = partialAnalysis || message;
    await assistantMessage.save();
    await ChatEvent.create({
      threadId: thread._id,
      messageId: assistantMessage._id,
      eventType: "error",
      payload: { msg: message }
    });
    if (!res.writableEnded) {
      res.write(formatSse("error", { msg: message, description: message, success: false }));
      res.end();
    }
  } finally {
    clearInterval(keepAlive);
  }
}

router.get(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter: Record<string, unknown> = { createdBy: req.user!._id, archived: false };
    if (search) filter.$text = { $search: search };
    const threads = await ChatThread.find(filter).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(80).lean();
    res.json({ threads });
  })
);

router.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = createThreadSchema.parse(req.body);
    const thread = await ChatThread.create({
      title: input.title ?? "New chat",
      model: input.model,
      visibility: input.visibility ?? "private",
      createdBy: req.user!._id,
      conversationHistory: []
    });
    res.status(201).json({ thread });
  })
);

router.get(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const thread = await ChatThread.findOne({ _id: id, createdBy: req.user!._id });
    if (!thread) throw new ApiError(404, "Chat not found");
    const messages = await ChatMessage.find({ threadId: thread._id }).sort({ createdAt: 1 }).lean();
    const events = await ChatEvent.find({ threadId: thread._id }).sort({ createdAt: 1 }).lean();
    res.json({ thread, messages, events });
  })
);

router.patch(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = updateThreadSchema.parse(req.body);
    const thread = await ChatThread.findOneAndUpdate(
      { _id: id, createdBy: req.user!._id },
      { $set: input },
      { new: true }
    );
    if (!thread) throw new ApiError(404, "Chat not found");
    res.json({ thread });
  })
);

router.delete(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const thread = await ChatThread.findOneAndUpdate(
      { _id: id, createdBy: req.user!._id },
      { $set: { archived: true } },
      { new: true }
    );
    if (!thread) throw new ApiError(404, "Chat not found");
    res.json({ ok: true });
  })
);

router.post(
  "/:id/messages/stream",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = messageSchema.parse(req.body);
    const thread = await ChatThread.findOne({ _id: id, createdBy: req.user!._id });
    if (!thread) throw new ApiError(404, "Chat not found");

    const userMessage = await ChatMessage.create({
      threadId: thread._id,
      role: "user",
      content: input.ask,
      status: "completed"
    });
    const assistantMessage = await ChatMessage.create({
      threadId: thread._id,
      role: "assistant",
      content: "",
      status: "streaming"
    });

    if (thread.title === "New chat" && input.ask.trim()) thread.title = makeTitle(input.ask);
    thread.lastMessageAt = new Date();
    await thread.save();

    await streamHolmesTurn({
      req,
      res,
      thread,
      assistantMessage,
      userMessageId: userMessage._id,
      ask: input.ask,
      model: input.model,
      conversationHistory: thread.conversationHistory,
      enableToolApproval: input.enableToolApproval,
      toolDecisions: input.toolDecisions
    });
  })
);

router.post(
  "/:id/messages/:messageId/approve",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const messageId = objectId.parse(req.params.messageId);
    const input = approveSchema.parse(req.body);

    const thread = await ChatThread.findOne({ _id: id, createdBy: req.user!._id });
    if (!thread) throw new ApiError(404, "Chat not found");

    const assistantMessage = await ChatMessage.findOne({
      _id: messageId,
      threadId: thread._id,
      role: "assistant"
    });
    if (!assistantMessage) throw new ApiError(404, "Message not found");
    if (assistantMessage.status !== "awaiting_approval") {
      throw new ApiError(409, "Message is not awaiting tool approval");
    }

    const meta = (assistantMessage.metadata ?? {}) as Record<string, unknown>;
    const conversationHistory = Array.isArray(meta.conversation_history)
      ? (meta.conversation_history as Record<string, unknown>[])
      : thread.conversationHistory;
    const pending = Array.isArray(meta.pending_approvals)
      ? (meta.pending_approvals as Record<string, unknown>[])
      : [];

    // Build Holmes-shaped decisions. Anchor on the pending tool_call_ids so a
    // stale/spoofed id can't slip through; any pending tool the client didn't
    // rule on is denied by default.
    const decisionMap = new Map(input.toolDecisions.map((d) => [d.toolCallId, d.approved]));
    const pendingIds = pending
      .map((p) => (typeof p.tool_call_id === "string" ? p.tool_call_id : undefined))
      .filter((value): value is string => Boolean(value));
    const ids = pendingIds.length > 0 ? pendingIds : [...decisionMap.keys()];
    const toolDecisions = ids.map((tool_call_id) => ({
      tool_call_id,
      approved: decisionMap.get(tool_call_id) ?? false
    }));

    assistantMessage.status = "streaming";
    await assistantMessage.save();

    await streamHolmesTurn({
      req,
      res,
      thread,
      assistantMessage,
      ask: "",
      model: input.model,
      conversationHistory,
      enableToolApproval: true,
      toolDecisions
    });
  })
);

export default router;
