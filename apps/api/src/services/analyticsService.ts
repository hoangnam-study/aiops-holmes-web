import { Incident } from "../models/Incident.js";
import { Alert } from "../models/Alert.js";
import { ChangeEvent } from "../models/ChangeEvent.js";
import { Feedback } from "../models/Feedback.js";

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

/** YYYY-MM-DD (UTC) buckets for every day in [since, now], inclusive. */
export function buildDateBuckets(since: Date, now: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (cursor <= end) {
    buckets.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

/** Merge per-day count maps onto a zero-filled date axis. */
export function mergeTimeseries(
  dates: string[],
  incidentByDay: Map<string, number>,
  alertByDay: Map<string, number>
): AnalyticsOverview["timeseries"] {
  return dates.map((date) => ({
    date,
    incidents: incidentByDay.get(date) ?? 0,
    alerts: alertByDay.get(date) ?? 0
  }));
}

function ratio(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 1000 : null;
}

function toCountMap(rows: Array<{ _id: unknown; count: number }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._id === null || row._id === undefined || row._id === "") continue;
    map.set(String(row._id), row.count);
  }
  return map;
}

function toPairs(rows: Array<{ _id: unknown; count: number }>): Array<{ key: string; count: number }> {
  return rows
    .filter((row) => row._id !== null && row._id !== undefined && row._id !== "")
    .map((row) => ({ key: String(row._id), count: row.count }));
}

export async function buildOverview(rangeDays = 30): Promise<AnalyticsOverview> {
  const days = Math.min(Math.max(Math.trunc(rangeDays) || 30, 1), 365);
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const dayGroup = (field: string) => ({
    $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: "UTC" }
  });

  const [
    incidentsTotal,
    incidentsOpen,
    alertsTotal,
    changesTotal,
    mttrRows,
    rcaRows,
    severityRows,
    feedbackRows,
    incidentSeriesRows,
    alertSeriesRows,
    namespaceRows,
    alertTitleRows
  ] = await Promise.all([
    Incident.countDocuments({ firstSeenAt: { $gte: since } }),
    Incident.countDocuments({ status: { $ne: "resolved" } }),
    Alert.countDocuments({ createdAt: { $gte: since } }),
    ChangeEvent.countDocuments({ occurredAt: { $gte: since } }),
    Incident.aggregate<{ _id: null; avg: number; count: number }>([
      { $match: { resolvedAt: { $ne: null, $gte: since } } },
      { $project: { durationMs: { $subtract: ["$resolvedAt", "$firstSeenAt"] } } },
      { $group: { _id: null, avg: { $avg: "$durationMs" }, count: { $sum: 1 } } }
    ]),
    Incident.aggregate<{ _id: string; count: number }>([
      { $match: { firstSeenAt: { $gte: since } } },
      { $group: { _id: "$rcaStatus", count: { $sum: 1 } } }
    ]),
    Incident.aggregate<{ _id: string; count: number }>([
      { $match: { firstSeenAt: { $gte: since } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Feedback.aggregate<{ _id: string; count: number }>([
      { $match: { targetType: "incident_rca", createdAt: { $gte: since } } },
      { $group: { _id: "$rating", count: { $sum: 1 } } }
    ]),
    Incident.aggregate<{ _id: string; count: number }>([
      { $match: { firstSeenAt: { $gte: since } } },
      { $group: { _id: dayGroup("firstSeenAt"), count: { $sum: 1 } } }
    ]),
    Alert.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: dayGroup("createdAt"), count: { $sum: 1 } } }
    ]),
    Incident.aggregate<{ _id: string; count: number }>([
      { $match: { firstSeenAt: { $gte: since } } },
      { $group: { _id: "$labels.namespace", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    Alert.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$title", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ])
  ]);

  const rcaMap = toCountMap(rcaRows);
  const rcaCompleted = rcaMap.get("completed") ?? 0;
  const rcaFailed = rcaMap.get("failed") ?? 0;

  const feedbackMap = toCountMap(feedbackRows);
  const feedbackUp = feedbackMap.get("up") ?? 0;
  const feedbackDown = feedbackMap.get("down") ?? 0;

  const mttr = mttrRows[0];

  return {
    rangeDays: days,
    since: since.toISOString(),
    summary: {
      incidentsTotal,
      incidentsOpen,
      mttrSeconds: mttr && mttr.count > 0 ? Math.round(mttr.avg / 1000) : null,
      resolvedCount: mttr?.count ?? 0,
      rcaCompleted,
      rcaFailed,
      rcaSuccessRate: ratio(rcaCompleted, rcaCompleted + rcaFailed),
      feedbackUp,
      feedbackDown,
      feedbackScore: ratio(feedbackUp, feedbackUp + feedbackDown),
      alertsTotal,
      changesTotal
    },
    timeseries: mergeTimeseries(buildDateBuckets(since, now), toCountMap(incidentSeriesRows), toCountMap(alertSeriesRows)),
    severity: toPairs(severityRows),
    rcaStatus: toPairs(rcaRows),
    topNamespaces: toPairs(namespaceRows),
    topAlerts: toPairs(alertTitleRows)
  };
}
