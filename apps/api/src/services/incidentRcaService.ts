import { Types } from "mongoose";
import { Alert } from "../models/Alert.js";
import { Incident, type IncidentDoc } from "../models/Incident.js";
import { getHolmesConnection } from "./settingsService.js";
import { HolmesClient } from "./holmesClient.js";
import { buildAdditionalSystemPrompt } from "./knowledgeService.js";
import { withJobLock } from "./jobLockService.js";
import { recordIncidentEvent } from "./incidentEventService.js";
import { dispatchIncidentNotifications } from "./notificationService.js";
import { buildChangeContext, findChangesForIncident } from "./changeEventService.js";

const queued = new Set<string>();

type IncidentLike = Pick<IncidentDoc, "title" | "severity" | "status" | "source" | "labels" | "firstSeenAt" | "lastSeenAt">;

function recordFromLabels(labels: IncidentLike["labels"]): Record<string, string> {
  return labels instanceof Map ? Object.fromEntries(labels) : (labels ?? {});
}

export function buildIncidentRcaPrompt(incident: IncidentLike, alerts: Array<{
  title: string;
  status: string;
  severity: string;
  description?: string;
  labels?: Record<string, string>;
  startsAt?: Date;
  endsAt?: Date;
}>, changeContext?: string) {
  const incidentLabels = recordFromLabels(incident.labels);
  const alertLines = alerts.slice(0, 20).map((alert, index) => {
    const labels = alert.labels ?? {};
    const workload = labels.service || labels.deployment || labels.statefulset || labels.daemonset || labels.pod || labels.job || "unknown";
    return [
      `${index + 1}. ${alert.title}`,
      `status=${alert.status}`,
      `severity=${alert.severity}`,
      `workload=${workload}`,
      alert.startsAt ? `startsAt=${alert.startsAt.toISOString()}` : "",
      alert.endsAt ? `endsAt=${alert.endsAt.toISOString()}` : "",
      alert.description ? `description=${alert.description}` : ""
    ].filter(Boolean).join(" | ");
  });

  return [
    "Automatically investigate this production incident and produce a concise SRE RCA.",
    "",
    "Return these sections:",
    "1. Most likely root cause",
    "2. Evidence used",
    "3. Impact and affected components",
    "4. Immediate mitigation",
    "5. Follow-up prevention",
    "",
    `Incident: ${incident.title}`,
    `Status: ${incident.status}`,
    `Severity: ${incident.severity}`,
    `Source: ${incident.source}`,
    `Labels: ${JSON.stringify(incidentLabels)}`,
    `First seen: ${incident.firstSeenAt.toISOString()}`,
    `Last seen: ${incident.lastSeenAt.toISOString()}`,
    "",
    "Alerts:",
    alertLines.length ? alertLines.join("\n") : "No alerts are currently attached.",
    ...(changeContext ? ["", changeContext] : [])
  ].join("\n");
}

export async function runIncidentRca(incidentId: string) {
  if (!Types.ObjectId.isValid(incidentId)) throw new Error("Invalid incident id");
  return withJobLock(`incident-rca:${incidentId}`, 10 * 60 * 1000, async () => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new Error("Incident not found");
    const alerts = await Alert.find({ incidentId: incident._id }).sort({ startsAt: -1, updatedAt: -1 }).limit(50);

    incident.rcaStatus = "investigating";
    incident.rcaError = undefined;
    incident.rcaStartedAt = new Date();
    await incident.save();
    await recordIncidentEvent({
      incidentId: incident._id,
      eventType: "rca_started",
      title: "Holmes started automatic RCA",
      payload: { alertCount: alerts.length }
    });

    try {
      const connection = await getHolmesConnection();
      const client = new HolmesClient(connection);
      const changes = await findChangesForIncident(incident);
      const changeContext = buildChangeContext(changes);
      const prompt = buildIncidentRcaPrompt(incident, alerts.map((alert) => ({
        title: alert.title,
        status: alert.status,
        severity: alert.severity,
        description: alert.description,
        labels: alert.labels,
        startsAt: alert.startsAt,
        endsAt: alert.endsAt
      })), changeContext);
      const additionalSystemPrompt = await buildAdditionalSystemPrompt();
      // The model occasionally ends an investigation with an empty answer
      // (a known capability ceiling of the configured tier). Empty completions
      // are nondeterministic, so retry once before giving up.
      let response = await client.chatToCompletion({
        ask: prompt,
        model: connection.defaultModel,
        request_source: "alert_auto_rca",
        source_ref: String(incident._id),
        additional_system_prompt: additionalSystemPrompt
      });
      if (!response.analysis.trim()) {
        response = await client.chatToCompletion({
          ask: prompt,
          model: connection.defaultModel,
          request_source: "alert_auto_rca",
          source_ref: String(incident._id),
          additional_system_prompt: additionalSystemPrompt
        });
      }

      if (!response.analysis.trim()) {
        throw new Error("Holmes returned an empty analysis after a retry (model produced no answer).");
      }

      incident.rcaStatus = "completed";
      incident.rcaSummary = response.analysis;
      incident.rcaCompletedAt = new Date();
      await incident.save();
      await recordIncidentEvent({
        incidentId: incident._id,
        eventType: "rca_completed",
        title: "Holmes completed RCA",
        detail: incident.rcaSummary?.slice(0, 500),
        payload: { completedAt: incident.rcaCompletedAt }
      });
      void dispatchIncidentNotifications("rca_completed", String(incident._id)).catch(() => undefined);
      return incident;
    } catch (error) {
      incident.rcaStatus = "failed";
      incident.rcaError = error instanceof Error ? error.message : String(error);
      incident.rcaCompletedAt = new Date();
      await incident.save();
      await recordIncidentEvent({
        incidentId: incident._id,
        eventType: "rca_failed",
        title: "Holmes RCA failed",
        detail: incident.rcaError,
        payload: { completedAt: incident.rcaCompletedAt }
      });
      void dispatchIncidentNotifications("rca_failed", String(incident._id)).catch(() => undefined);
      return incident;
    }
  });
}

export async function enqueueIncidentRca(incidentId: string) {
  if (queued.has(incidentId)) return;
  queued.add(incidentId);
  const incident = await Incident.findByIdAndUpdate(
    incidentId,
    { $set: { rcaStatus: "queued", rcaError: null } },
    { new: true }
  );
  if (!incident) {
    queued.delete(incidentId);
    return;
  }
  await recordIncidentEvent({
    incidentId: incident._id,
    eventType: "rca_queued",
    title: "Automatic RCA queued",
    payload: { queuedAt: new Date() }
  });

  setTimeout(() => {
    void runIncidentRca(incidentId).finally(() => queued.delete(incidentId));
  }, 0).unref?.();
}
