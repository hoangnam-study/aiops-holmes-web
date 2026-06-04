export type AlertSeverity = "critical" | "warning" | "info" | "unknown";
export type AlertStatus = "firing" | "resolved";

export interface NormalizedAlert {
  fingerprint: string;
  status: AlertStatus;
  severity: AlertSeverity;
  source: string;
  title: string;
  description: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt?: Date;
  endsAt?: Date;
  generatorURL?: string;
  incidentKey: string;
  rawPayload: Record<string, unknown>;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null)
      .map(([key, item]) => [key, String(item)])
  );
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeSeverity(value: string | undefined): AlertSeverity {
  const severity = value?.toLowerCase();
  if (severity === "critical" || severity === "warning" || severity === "info") return severity;
  return "unknown";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function incidentKeyFromLabels(labels: Record<string, string>) {
  const parts = [
    labels.cluster,
    labels.namespace,
    labels.alertname || labels.alert,
    labels.service || labels.deployment || labels.statefulset || labels.daemonset || labels.pod || labels.job
  ]
    .filter(Boolean)
    .map((part) => String(part).trim().toLowerCase());
  return parts.length ? parts.join(":") : `ungrouped:${hashString(JSON.stringify(labels))}`;
}

export function normalizeAlertmanagerPayload(payload: unknown): NormalizedAlert[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const source = typeof root.receiver === "string" ? root.receiver : "alertmanager";
  const alerts = Array.isArray(root.alerts) ? root.alerts : [root];

  return alerts.map((raw, index) => {
    const alert = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const labels = stringRecord(alert.labels);
    const annotations = stringRecord(alert.annotations);
    const status = alert.status === "resolved" ? "resolved" : "firing";
    const title = annotations.summary || annotations.title || labels.alertname || labels.alert || "Alert";
    const description = annotations.description || annotations.message || "";
    const fallbackFingerprint = hashString(JSON.stringify({ labels, startsAt: alert.startsAt, index }));
    const fingerprint = String(alert.fingerprint || labels.fingerprint || fallbackFingerprint);

    return {
      fingerprint,
      status,
      severity: normalizeSeverity(labels.severity),
      source,
      title,
      description,
      labels,
      annotations,
      startsAt: parseDate(alert.startsAt),
      endsAt: parseDate(alert.endsAt),
      generatorURL: typeof alert.generatorURL === "string" ? alert.generatorURL : undefined,
      incidentKey: incidentKeyFromLabels(labels),
      rawPayload: alert
    };
  });
}
