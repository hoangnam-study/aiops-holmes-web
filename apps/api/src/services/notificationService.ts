import { Types } from "mongoose";
import { NotificationDelivery } from "../models/NotificationDelivery.js";
import { NotificationSink, type NotificationSinkDoc } from "../models/NotificationSink.js";
import { RoutingRule } from "../models/RoutingRule.js";
import { Incident, type IncidentDoc } from "../models/Incident.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";

export function publicNotificationSink(sink: NotificationSinkDoc & { _id: unknown; toObject: () => Record<string, any> }) {
  const obj = sink.toObject();
  return {
    ...obj,
    _id: String(obj._id),
    createdBy: String(obj.createdBy),
    hasUrl: Boolean(obj.urlEncrypted),
    urlEncrypted: undefined
  };
}

export function notificationSinkUpdate(input: {
  name?: string;
  type?: "webhook" | "slackWebhook" | "teamsWebhook";
  enabled?: boolean;
  url?: string | null;
  clearUrl?: boolean;
}) {
  const update: Record<string, unknown> = {};
  for (const field of ["name", "type", "enabled"] as const) {
    if (input[field] !== undefined) update[field] = input[field];
  }
  if (input.clearUrl) update.urlEncrypted = null;
  if (input.url) update.urlEncrypted = encryptSecret(input.url);
  return update;
}

function incidentPlainLabels(labels: IncidentDoc["labels"]): Record<string, string> {
  return labels instanceof Map ? Object.fromEntries(labels) : (labels ?? {});
}

export function formatIncidentNotification(eventType: string, incident: IncidentDoc & { _id: unknown }) {
  const labels = incidentPlainLabels(incident.labels);
  const lines = [
    `*${eventType.replace(/_/g, " ").toUpperCase()}*`,
    `Incident: ${incident.title}`,
    `Status: ${incident.status}`,
    `Severity: ${incident.severity}`,
    labels.cluster || labels.namespace ? `Scope: ${[labels.cluster, labels.namespace].filter(Boolean).join(" / ")}` : "",
    incident.rcaSummary ? `RCA: ${incident.rcaSummary.slice(0, 1500)}` : "",
    incident.rcaError ? `Error: ${incident.rcaError}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

async function deliverWebhook(input: {
  sink: NotificationSinkDoc & { _id: Types.ObjectId };
  routingRuleId?: Types.ObjectId;
  eventType: string;
  text: string;
  payload: Record<string, unknown>;
}) {
  const url = decryptSecret(input.sink.urlEncrypted);
  if (!url) return;
  const body =
    input.sink.type === "teamsWebhook"
      ? { text: input.text }
      : input.sink.type === "slackWebhook"
        ? { text: input.text }
        : { text: input.text, ...input.payload };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
    const responseBody = await response.text().catch(() => "");
    await NotificationDelivery.create({
      sinkId: input.sink._id,
      routingRuleId: input.routingRuleId,
      eventType: input.eventType,
      status: response.ok ? "success" : "error",
      target: input.sink.name,
      requestPayload: body,
      responseStatus: response.status,
      responseBody: responseBody.slice(0, 2000)
    });
  } catch (error) {
    await NotificationDelivery.create({
      sinkId: input.sink._id,
      routingRuleId: input.routingRuleId,
      eventType: input.eventType,
      status: "error",
      target: input.sink.name,
      requestPayload: body,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function dispatchIncidentNotifications(eventType: "alert_ingested" | "rca_completed" | "rca_failed" | "incident_status_changed", incidentId: string) {
  const incident = await Incident.findById(incidentId);
  if (!incident) return;
  const rules = await RoutingRule.find({ enabled: true, eventType });
  const text = formatIncidentNotification(eventType, incident);
  for (const rule of rules) {
    if (rule.severity && rule.severity !== "any" && rule.severity !== incident.severity) continue;
    if (rule.status && rule.status !== incident.status) continue;
    const sink = await NotificationSink.findOne({ _id: rule.sinkId, enabled: true });
    if (!sink) continue;
    await deliverWebhook({
      sink: sink as NotificationSinkDoc & { _id: Types.ObjectId },
      routingRuleId: rule._id,
      eventType,
      text,
      payload: {
        eventType,
        incidentId,
        incident: {
          title: incident.title,
          status: incident.status,
          severity: incident.severity,
          labels: incidentPlainLabels(incident.labels),
          rcaSummary: incident.rcaSummary,
          rcaError: incident.rcaError
        }
      }
    });
  }
}
