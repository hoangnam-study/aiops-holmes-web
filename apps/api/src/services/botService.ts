import { ChatMessage } from "../models/ChatMessage.js";
import { ChatThread } from "../models/ChatThread.js";
import { User } from "../models/User.js";
import { getHolmesConnection } from "./settingsService.js";
import { HolmesClient } from "./holmesClient.js";
import { buildAdditionalSystemPrompt } from "./knowledgeService.js";
import { mergeConversationHistory } from "./holmesEvents.js";

export type BotProvider = "slack" | "teams";

export interface BotPrompt {
  text: string;
  externalUser?: string;
  externalChannel?: string;
  externalTeam?: string;
  rawPayload: Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stripMentions(text: string) {
  return text.replace(/<@[A-Z0-9]+>/gi, "").replace(/@\w+/g, "").replace(/\s+/g, " ").trim();
}

export function extractSlackPrompt(payload: Record<string, unknown>): BotPrompt {
  const event = payload.event && typeof payload.event === "object" ? (payload.event as Record<string, unknown>) : undefined;
  const text = stripMentions(stringValue(payload.text) || stringValue(event?.text));
  return {
    text,
    externalUser: stringValue(payload.user_id) || stringValue(event?.user),
    externalChannel: stringValue(payload.channel_id) || stringValue(event?.channel),
    externalTeam: stringValue(payload.team_id) || stringValue(payload.team),
    rawPayload: payload
  };
}

export function extractTeamsPrompt(payload: Record<string, unknown>): BotPrompt {
  const from = payload.from && typeof payload.from === "object" ? (payload.from as Record<string, unknown>) : undefined;
  const conversation = payload.conversation && typeof payload.conversation === "object"
    ? (payload.conversation as Record<string, unknown>)
    : undefined;
  return {
    text: stripMentions(stringValue(payload.text) || stringValue(payload.value)),
    externalUser: stringValue(from?.id) || stringValue(from?.name),
    externalChannel: stringValue(conversation?.id),
    externalTeam: stringValue(conversation?.tenantId),
    rawPayload: payload
  };
}

export async function runBotPrompt(provider: BotProvider, prompt: BotPrompt) {
  if (!prompt.text) throw new Error("Bot prompt is empty");
  const owner = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
  if (!owner) throw new Error("No admin user exists to own bot conversations");

  const connection = await getHolmesConnection();
  const client = new HolmesClient(connection);
  const thread = await ChatThread.create({
    title: `${provider === "slack" ? "Slack" : "Teams"}: ${prompt.text.slice(0, 72)}`,
    model: connection.defaultModel,
    visibility: "shared",
    createdBy: owner._id,
    conversationHistory: [],
    lastMessageAt: new Date()
  });
  await ChatMessage.create({
    threadId: thread._id,
    role: "user",
    content: prompt.text,
    status: "completed",
    metadata: {
      provider,
      externalUser: prompt.externalUser,
      externalChannel: prompt.externalChannel,
      externalTeam: prompt.externalTeam
    }
  });

  try {
    const response = await client.chatToCompletion({
      ask: prompt.text,
      model: connection.defaultModel,
      request_source: `${provider}_bot`,
      source_ref: prompt.externalChannel,
      conversation_id: String(thread._id),
      conversation_source: provider,
      additional_system_prompt: await buildAdditionalSystemPrompt(),
      meta: {
        externalUser: prompt.externalUser,
        externalChannel: prompt.externalChannel,
        externalTeam: prompt.externalTeam
      }
    });
    const answer = response.analysis ?? "";
    await ChatMessage.create({
      threadId: thread._id,
      role: "assistant",
      content: answer,
      status: answer ? "completed" : "error",
      metadata: response.metadata ?? {}
    });
    thread.conversationHistory = mergeConversationHistory(
      thread.conversationHistory,
      response.conversation_history,
      prompt.text,
      answer
    );
    thread.lastMessageAt = new Date();
    await thread.save();
    return { thread, answer: answer || "Holmes returned an empty response." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ChatMessage.create({
      threadId: thread._id,
      role: "assistant",
      content: message,
      status: "error",
      metadata: { provider, error: true }
    });
    throw error;
  }
}
