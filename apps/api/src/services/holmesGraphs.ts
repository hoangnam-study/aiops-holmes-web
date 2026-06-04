// Holmes embeds Prometheus graphs in its answer text as a token:
//   <<{"type": "promql", "tool_name": "execute_prometheus_range_query", "tool_call_id": "<id>"}>>
// The actual time-series lives in the matching `tool_calling_result` SSE event,
// whose `result.data` is a JSON string holding a standard Prometheus
// query_range matrix. These helpers turn that tool result into compact graph
// data we persist on the assistant message + render as a chart in the UI.

export interface GraphPoint {
  t: number; // unix seconds
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

export const PROM_GRAPH_TOOLS = new Set([
  "execute_prometheus_range_query",
  "execute_prometheus_instant_query"
]);

const MAX_SERIES = 12;
const MAX_POINTS = 300;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Short, distinguishing series name from Prometheus metric labels. */
export function seriesName(labels: Record<string, unknown>, index: number): string {
  for (const key of ["pod", "container", "name", "instance", "deployment", "service", "job", "__name__"]) {
    const value = labels[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `series ${index + 1}`;
}

/** Evenly downsample points to at most MAX_POINTS, always keeping the last. */
function downsample(points: GraphPoint[]): GraphPoint[] {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  const out: GraphPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]!);
  const last = points[points.length - 1]!;
  if (out[out.length - 1]!.t !== last.t) out.push(last);
  return out;
}

/**
 * Parse a `tool_calling_result` event payload into graph data, or null when it
 * is not a Prometheus query result or carries no usable matrix.
 */
export function parsePrometheusGraph(payload: unknown): GraphData | null {
  const root = asRecord(payload);
  const toolName = typeof root.tool_name === "string" ? root.tool_name : "";
  if (!PROM_GRAPH_TOOLS.has(toolName)) return null;
  const toolCallId = typeof root.tool_call_id === "string" ? root.tool_call_id : "";
  if (!toolCallId) return null;

  const result = asRecord(root.result);
  let inner: unknown = result.data;
  if (typeof inner === "string") {
    try {
      inner = JSON.parse(inner);
    } catch {
      return null;
    }
  }
  const innerRecord = asRecord(inner);
  const matrix = asRecord(innerRecord.data);
  const rows = Array.isArray(matrix.result) ? matrix.result : [];
  if (matrix.resultType !== "matrix" || rows.length === 0) return null;

  const params = asRecord(result.params);
  const series: GraphSeries[] = [];
  for (let i = 0; i < rows.length && series.length < MAX_SERIES; i += 1) {
    const row = asRecord(rows[i]);
    const labels = asRecord(row.metric);
    const rawValues = Array.isArray(row.values) ? row.values : [];
    const points: GraphPoint[] = [];
    for (const pair of rawValues) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const t = Number(pair[0]);
      const v = Number(pair[1]);
      if (Number.isFinite(t) && Number.isFinite(v)) points.push({ t, v });
    }
    if (points.length) series.push({ name: seriesName(labels, i), points: downsample(points) });
  }
  if (!series.length) return null;

  return {
    toolCallId,
    toolName,
    description: typeof root.description === "string" ? root.description : undefined,
    query: typeof params.query === "string" ? params.query : undefined,
    series
  };
}
