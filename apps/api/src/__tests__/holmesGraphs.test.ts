import { describe, expect, it } from "vitest";
import { parsePrometheusGraph, seriesName } from "../services/holmesGraphs.js";

function matrixPayload() {
  return {
    tool_call_id: "call_abc",
    tool_name: "execute_prometheus_range_query",
    description: "Memory usage for accounting container",
    result: {
      params: { query: 'container_memory_working_set_bytes{container="accounting"}' },
      data: JSON.stringify({
        status: "success",
        data: {
          resultType: "matrix",
          result: [
            {
              metric: { __name__: "container_memory_working_set_bytes", container: "accounting", pod: "accounting-7f9" },
              values: [
                [1780565133, "163139584"],
                [1780565193, "163110912"],
                [1780565253, "164000000"]
              ]
            }
          ]
        }
      })
    }
  };
}

describe("parsePrometheusGraph", () => {
  it("parses a range-query matrix into graph series", () => {
    const graph = parsePrometheusGraph(matrixPayload());
    expect(graph).not.toBeNull();
    expect(graph!.toolCallId).toBe("call_abc");
    expect(graph!.query).toContain("container_memory_working_set_bytes");
    expect(graph!.series).toHaveLength(1);
    expect(graph!.series[0]!.name).toBe("accounting-7f9");
    expect(graph!.series[0]!.points).toEqual([
      { t: 1780565133, v: 163139584 },
      { t: 1780565193, v: 163110912 },
      { t: 1780565253, v: 164000000 }
    ]);
  });

  it("ignores non-prometheus tool results", () => {
    expect(parsePrometheusGraph({ tool_name: "kubectl_get", tool_call_id: "x", result: {} })).toBeNull();
  });

  it("returns null for an empty or non-matrix result", () => {
    const payload = matrixPayload();
    payload.result.data = JSON.stringify({ data: { resultType: "vector", result: [] } });
    expect(parsePrometheusGraph(payload)).toBeNull();
  });

  it("tolerates an already-parsed result.data object", () => {
    const payload = matrixPayload();
    (payload.result as { data: unknown }).data = JSON.parse(payload.result.data as string);
    expect(parsePrometheusGraph(payload)).not.toBeNull();
  });
});

describe("seriesName", () => {
  it("prefers pod, then container, then name", () => {
    expect(seriesName({ pod: "p", container: "c" }, 0)).toBe("p");
    expect(seriesName({ container: "c", __name__: "m" }, 0)).toBe("c");
    expect(seriesName({}, 3)).toBe("series 4");
  });
});
