export interface User {
  id: string;
  email: string;
  role: "admin";
}

export interface Settings {
  holmesApiUrl: string;
  hasHolmesApiKey: boolean;
  defaultModel: string;
  timezone: string;
}

export interface HolmesStatus {
  healthz: "ok" | "error";
  readyz: "ok" | "error";
  model?: unknown;
  errors: string[];
  defaultModel: string;
  baseUrl: string;
}

export interface ChatThread {
  _id: string;
  title: string;
  model?: string;
  visibility: "private" | "shared";
  archived: boolean;
  conversationHistory: Record<string, unknown>[];
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  threadId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status: "pending" | "streaming" | "completed" | "awaiting_approval" | "error";
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatEvent {
  _id: string;
  threadId: string;
  messageId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Incident {
  _id: string;
  key: string;
  title: string;
  status: "open" | "acknowledged" | "resolved";
  severity: "critical" | "warning" | "info" | "unknown";
  source: string;
  labels: Record<string, string>;
  alertCount: number;
  rcaStatus: "not_started" | "queued" | "investigating" | "completed" | "failed";
  rcaSummary?: string;
  rcaError?: string;
  rcaStartedAt?: string;
  rcaCompletedAt?: string;
  assignee?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  _id: string;
  incidentId: string;
  fingerprint: string;
  status: "firing" | "resolved";
  severity: "critical" | "warning" | "info" | "unknown";
  source: string;
  title: string;
  description: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataSource {
  _id: string;
  key: string;
  title: string;
  category: string;
  description: string;
  status: "connected" | "configured" | "unknown" | "failed";
  toolsetKey?: string;
  lastVerifiedAt?: string;
  verificationMessage?: string;
}

export interface KnowledgeEntry {
  _id: string;
  title: string;
  content: string;
  scope: "global" | "personal" | "agent";
  type: "instruction" | "skill";
  enabled: boolean;
  tags: string[];
  updatedAt: string;
}

export interface ScheduledPrompt {
  _id: string;
  title: string;
  prompt: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  model?: string;
  destination: {
    type: "none" | "slackWebhook";
    hasWebhook: boolean;
  };
  lastRunAt?: string;
  lastStatus?: "success" | "error" | "running";
  updatedAt: string;
}

export interface ScheduledPromptRun {
  _id: string;
  scheduledPromptId: string;
  status: "running" | "success" | "error";
  trigger: "scheduled" | "manual";
  startedAt: string;
  completedAt?: string;
  answer?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  toolEvents: Record<string, unknown>[];
}

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}
