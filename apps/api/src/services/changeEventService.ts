import { Types } from "mongoose";
import { ChangeEvent, type ChangeKind } from "../models/ChangeEvent.js";
import { Incident, type IncidentDoc } from "../models/Incident.js";
import { recordIncidentEvent } from "./incidentEventService.js";

export interface NormalizedChange {
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
  occurredAt: Date;
  rawPayload: Record<string, unknown>;
}

const changeKinds: ChangeKind[] = [
  "deploy",
  "config_change",
  "scale",
  "rollback",
  "image_change",
  "feature_flag",
  "other"
];

// Default lookback: a change up to this long before an incident first fired is a
// candidate cause. Robusta-style "what changed just before the alert".
export const CHANGE_CORRELATION_WINDOW_MS = 6 * 60 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asRecord(value))
      .filter(([, item]) => item !== undefined && item !== null)
      .map(([key, item]) => [key, String(item)])
  );
}

function firstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? undefined : fromNumber;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeKind(value: string | undefined): ChangeKind {
  const kind = value?.toLowerCase().replace(/[\s-]+/g, "_");
  if (kind && (changeKinds as string[]).includes(kind)) return kind as ChangeKind;
  if (kind === "configmap" || kind === "config" || kind === "secret") return "config_change";
  if (kind === "image" || kind === "tag") return "image_change";
  if (kind === "hpa" || kind === "replicas" || kind === "scaling") return "scale";
  if (kind === "revert" || kind === "undo") return "rollback";
  if (kind === "flag" || kind === "toggle") return "feature_flag";
  if (kind === "deployment" || kind === "release" || kind === "sync" || kind === "apply") return "deploy";
  return "other";
}

export function workloadFromLabels(labels: Record<string, string>): string | undefined {
  return (
    labels.workload ||
    labels.service ||
    labels.deployment ||
    labels.statefulset ||
    labels.daemonset ||
    labels.app ||
    labels.pod ||
    labels.job ||
    undefined
  );
}

/**
 * Accepts a flexible change payload (ArgoCD, Flux, GitHub deploy, Kubernetes event,
 * or a hand-rolled webhook) and normalizes it into a `ChangeEvent`-shaped record.
 */
export function normalizeChangeEvent(payload: unknown): NormalizedChange {
  const root = asRecord(payload);
  const labels = stringRecord(root.labels);

  const cluster = firstString(root, ["cluster", "clusterName"]) ?? labels.cluster;
  const namespace = firstString(root, ["namespace", "ns"]) ?? labels.namespace;
  const explicitWorkload = firstString(root, ["workload", "deployment", "service", "app", "name", "resource"]);
  const workload = explicitWorkload ?? workloadFromLabels(labels);
  const service = firstString(root, ["service", "app"]) ?? labels.service ?? labels.app;
  const version = firstString(root, ["version", "revision", "image", "tag", "newVersion", "sha", "commit"]);
  const previousVersion = firstString(root, ["previousVersion", "oldVersion", "fromVersion", "previousImage"]);
  const source = firstString(root, ["source", "tool", "origin", "provider"]) ?? "manual";
  const author = firstString(root, ["author", "user", "actor", "triggeredBy", "deployer"]);
  const kind = normalizeKind(firstString(root, ["kind", "type", "eventType", "changeType"]));

  const titleBase = firstString(root, ["title", "summary", "message", "name"]);
  const title =
    titleBase ??
    [kind.replace(/_/g, " "), workload, version ? `-> ${version}` : ""].filter(Boolean).join(" ").trim() ??
    "Change";

  return {
    kind,
    title: title || "Change",
    description: firstString(root, ["description", "details", "body", "notes"]),
    cluster,
    namespace,
    workload,
    service,
    labels,
    author,
    source,
    version,
    previousVersion,
    link: firstString(root, ["link", "url", "generatorURL", "htmlUrl"]),
    occurredAt:
      parseDate(root.occurredAt ?? root.timestamp ?? root.time ?? root.date ?? root.startsAt ?? root.deployedAt) ??
      new Date(),
    rawPayload: root
  };
}

function incidentLabels(labels: IncidentDoc["labels"]): Record<string, string> {
  return labels instanceof Map ? Object.fromEntries(labels) : (labels ?? {});
}

/**
 * A change and an incident are considered related when they share a namespace and
 * (where both are known) the same cluster and workload. Namespace is required on
 * both sides to avoid over-correlating cluster-wide noise.
 */
export function changeMatchesIncidentLabels(
  change: Pick<NormalizedChange, "cluster" | "namespace" | "workload">,
  incidentLabelMap: Record<string, string>
): boolean {
  const incidentNamespace = incidentLabelMap.namespace;
  if (!change.namespace || !incidentNamespace) return false;
  if (change.namespace !== incidentNamespace) return false;

  const incidentCluster = incidentLabelMap.cluster;
  if (change.cluster && incidentCluster && change.cluster !== incidentCluster) return false;

  const incidentWorkload = workloadFromLabels(incidentLabelMap);
  if (change.workload && incidentWorkload && change.workload !== incidentWorkload) return false;

  return true;
}

/**
 * Correlate a freshly-recorded change to active incidents whose first alert fired
 * within the lookback window after the change, and record a timeline event on each.
 */
export async function correlateChangeToIncidents(
  changeId: Types.ObjectId | string,
  change: NormalizedChange,
  windowMs = CHANGE_CORRELATION_WINDOW_MS
): Promise<string[]> {
  if (!change.namespace) return [];
  const since = new Date(change.occurredAt.getTime() - 60_000); // small clock-skew grace
  const until = new Date(change.occurredAt.getTime() + windowMs);

  const candidates = await Incident.find({
    status: { $ne: "resolved" },
    firstSeenAt: { $gte: since, $lte: until }
  })
    .sort({ firstSeenAt: -1 })
    .limit(100);

  const matchedIds: string[] = [];
  for (const incident of candidates) {
    if (!changeMatchesIncidentLabels(change, incidentLabels(incident.labels))) continue;
    matchedIds.push(String(incident._id));
    await recordIncidentEvent({
      incidentId: incident._id,
      eventType: "change_detected",
      title: `Change before incident: ${change.title}`,
      detail: [change.source, change.version ? `version ${change.version}` : "", change.author ? `by ${change.author}` : ""]
        .filter(Boolean)
        .join(" · "),
      payload: {
        changeId: String(changeId),
        kind: change.kind,
        workload: change.workload,
        version: change.version,
        occurredAt: change.occurredAt
      }
    });
  }

  if (matchedIds.length) {
    await ChangeEvent.findByIdAndUpdate(changeId, {
      $addToSet: { incidentIds: { $each: matchedIds.map((id) => new Types.ObjectId(id)) } }
    });
  }
  return matchedIds;
}

export async function recordChangeEvent(
  change: NormalizedChange,
  createdBy?: Types.ObjectId | string
): Promise<{ changeId: string; incidentIds: string[] }> {
  const doc = await ChangeEvent.create({ ...change, createdBy, incidentIds: [] });
  const incidentIds = await correlateChangeToIncidents(doc._id, change);
  return { changeId: String(doc._id), incidentIds };
}

/** Changes relevant to an incident: correlated, or matching by labels within the window. */
export async function findChangesForIncident(
  incident: Pick<IncidentDoc, "labels" | "firstSeenAt" | "lastSeenAt">,
  windowMs = CHANGE_CORRELATION_WINDOW_MS
) {
  const labelMap = incidentLabels(incident.labels);
  const namespace = labelMap.namespace;
  if (!namespace) return [];
  const since = new Date(incident.firstSeenAt.getTime() - windowMs);
  const candidates = await ChangeEvent.find({
    namespace,
    occurredAt: { $gte: since, $lte: incident.lastSeenAt }
  })
    .sort({ occurredAt: -1 })
    .limit(50)
    .lean();

  return candidates.filter((change) =>
    changeMatchesIncidentLabels(
      { cluster: change.cluster, namespace: change.namespace, workload: change.workload },
      labelMap
    )
  );
}

/** Build a compact "recent changes" text block to inject into the RCA prompt. */
export function buildChangeContext(
  changes: Array<Pick<NormalizedChange, "kind" | "title" | "workload" | "version" | "previousVersion" | "author" | "source" | "occurredAt">>
): string {
  if (!changes.length) return "";
  const lines = changes.slice(0, 15).map((change, index) => {
    return [
      `${index + 1}. [${change.kind}] ${change.title}`,
      change.workload ? `workload=${change.workload}` : "",
      change.previousVersion && change.version
        ? `version=${change.previousVersion}->${change.version}`
        : change.version
          ? `version=${change.version}`
          : "",
      change.author ? `author=${change.author}` : "",
      `source=${change.source}`,
      `at=${change.occurredAt.toISOString()}`
    ]
      .filter(Boolean)
      .join(" | ");
  });
  return [
    "Recent changes shortly before this incident (most recent first) — evaluate these as likely root causes:",
    lines.join("\n")
  ].join("\n");
}
