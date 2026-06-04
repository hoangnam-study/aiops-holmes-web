export interface User {
  id: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  createdAt?: string;
  updatedAt?: string;
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

export interface IncidentEvent {
  _id: string;
  incidentId: string;
  eventType:
    | "alert_ingested"
    | "status_changed"
    | "rca_queued"
    | "rca_started"
    | "rca_completed"
    | "rca_failed"
    | "change_detected"
    | "comment";
  title: string;
  detail?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ChangeKind =
  | "deploy"
  | "config_change"
  | "scale"
  | "rollback"
  | "image_change"
  | "feature_flag"
  | "other";

export interface ChangeEvent {
  _id: string;
  kind: ChangeKind;
  title: string;
  description?: string;
  cluster?: string;
  namespace?: string;
  workload?: string;
  service?: string;
  labels: Record<string, string>;
  author?: string;
  source: string;
  version?: string;
  previousVersion?: string;
  link?: string;
  occurredAt: string;
  incidentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackSummary {
  up: number;
  down: number;
}

export interface FeedbackEntry {
  _id: string;
  targetType: "incident_rca" | "chat_message";
  targetId: string;
  rating: "up" | "down";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphPoint {
  t: number;
  v: number;
}

export interface GraphSeries {
  name: string;
  points: GraphPoint[];
}

export interface GraphData {
  toolCallId: string;
  toolName: string;
  description?: string;
  query?: string;
  series: GraphSeries[];
}

export interface AnalyticsOverview {
  rangeDays: number;
  since: string;
  summary: {
    incidentsTotal: number;
    incidentsOpen: number;
    mttrSeconds: number | null;
    resolvedCount: number;
    rcaCompleted: number;
    rcaFailed: number;
    rcaSuccessRate: number | null;
    feedbackUp: number;
    feedbackDown: number;
    feedbackScore: number | null;
    alertsTotal: number;
    changesTotal: number;
  };
  timeseries: Array<{ date: string; incidents: number; alerts: number }>;
  severity: Array<{ key: string; count: number }>;
  rcaStatus: Array<{ key: string; count: number }>;
  topNamespaces: Array<{ key: string; count: number }>;
  topAlerts: Array<{ key: string; count: number }>;
}

export interface DataSource {
  _id: string;
  key: string;
  title: string;
  category: string;
  description: string;
  status: "connected" | "configured" | "unknown" | "failed";
  enabled: boolean;
  toolsetKey?: string;
  capabilities: string[];
  docsUrl?: string;
  configSchema?: Record<string, unknown>;
  secretFields: string[];
  verifyPrompt: string;
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

export interface NotificationSink {
  _id: string;
  name: string;
  type: "webhook" | "slackWebhook" | "teamsWebhook";
  enabled: boolean;
  hasUrl: boolean;
  updatedAt: string;
}

export interface RoutingRule {
  _id: string;
  name: string;
  enabled: boolean;
  eventType: "alert_ingested" | "rca_completed" | "rca_failed" | "incident_status_changed";
  sinkId: string;
  severity: "critical" | "warning" | "info" | "unknown" | "any";
  status?: string;
  updatedAt: string;
}

export interface NotificationDelivery {
  _id: string;
  sinkId: string;
  routingRuleId?: string;
  eventType: string;
  status: "success" | "error";
  target: string;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Cluster {
  _id: string;
  name: string;
  slug: string;
  environment?: string;
  status: "unknown" | "healthy" | "degraded" | "offline";
  apiUrl?: string;
  lastHeartbeatAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  _id: string;
  clusterId: string;
  agentId: string;
  version?: string;
  status: "healthy" | "degraded" | "offline";
  metadata: Record<string, unknown>;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheck {
  _id: string;
  title: string;
  prompt: string;
  scope?: string;
  labels: string[];
  enabled: boolean;
  alertMode: "none" | "notify_on_failure" | "always_notify";
  lastRunAt?: string;
  lastStatus?: "success" | "error" | "running";
  updatedAt: string;
}

export interface HealthCheckRun {
  _id: string;
  healthCheckId: string;
  status: "running" | "success" | "error";
  startedAt: string;
  completedAt?: string;
  answer?: string;
  error?: string;
}

export interface Runbook {
  _id: string;
  title: string;
  description?: string;
  content: string;
  source: "manual" | "git" | "uploaded";
  sourceRef?: string;
  matchers: string[];
  tags: string[];
  enabled: boolean;
  updatedAt: string;
}

export interface RunbookExecution {
  _id: string;
  runbookId: string;
  status: "running" | "success" | "error";
  incidentId?: string;
  scope?: string;
  startedAt: string;
  completedAt?: string;
  report?: string;
  error?: string;
}

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
}
