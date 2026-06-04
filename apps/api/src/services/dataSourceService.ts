import { DataSource, type DataSourceDoc } from "../models/DataSource.js";

type SeedSource = Omit<DataSourceDoc, "createdAt" | "updatedAt">;

const defaultSetup = (toolset: string) => `### Helm values

\`\`\`yaml
holmesgpt:
  toolsets:
    ${toolset}:
      enabled: true
\`\`\`

V1 is read-mostly: apply values through your existing aiops-stack Helm workflow, then use Verify with Holmes from this page.`;

const seeds: SeedSource[] = [
  {
    key: "kubernetes-core",
    title: "Kubernetes/Core",
    category: "Kubernetes",
    description: "Inspect workloads, events, pods, deployments, and cluster health.",
    status: "connected",
    toolsetKey: "kubernetes/core",
    verifyPrompt: "Verify that the Kubernetes/Core Holmes toolset can list namespaces and summarize cluster health. Keep it concise.",
    setupMarkdown: defaultSetup("kubernetes")
  },
  {
    key: "prometheus-metrics",
    title: "Prometheus",
    category: "Metrics",
    description: "Query Mimir/Prometheus metrics for RCA evidence and charts.",
    status: "connected",
    toolsetKey: "prometheus/metrics",
    verifyPrompt: "Verify that the Prometheus metrics toolset is reachable. Run a simple up or pod health query and summarize the result.",
    setupMarkdown: defaultSetup("prometheus")
  },
  {
    key: "grafana-loki",
    title: "Loki",
    category: "Logs",
    description: "Search application and platform logs through Grafana Loki.",
    status: "connected",
    toolsetKey: "grafana/loki",
    verifyPrompt: "Verify that the Loki log toolset is reachable. Search recent logs in the observability namespaces and summarize any signal.",
    setupMarkdown: defaultSetup("loki")
  },
  {
    key: "grafana-tempo",
    title: "Tempo",
    category: "Traces",
    description: "Use distributed traces and span metrics during investigations.",
    status: "connected",
    toolsetKey: "grafana/tempo",
    verifyPrompt: "Verify that the Tempo trace toolset is reachable. Summarize whether trace data appears available.",
    setupMarkdown: defaultSetup("tempo")
  },
  {
    key: "grafana-pyroscope",
    title: "Pyroscope",
    category: "Profiles",
    description: "Use profiling evidence for CPU, memory, and performance investigations.",
    status: "connected",
    toolsetKey: "grafana/pyroscope",
    verifyPrompt: "Verify that the Pyroscope profiling toolset is reachable. Summarize whether profiles appear available.",
    setupMarkdown: defaultSetup("pyroscope")
  },
  {
    key: "grafana-dashboards",
    title: "Grafana/Dashboards",
    category: "Dashboards",
    description: "Future dashboard rendering and panel context for Holmes.",
    status: "unknown",
    toolsetKey: "grafana/dashboards",
    verifyPrompt: "Check whether Holmes can access Grafana dashboards and summarize what is configured.",
    setupMarkdown: defaultSetup("grafana")
  },
  {
    key: "elasticsearch",
    title: "Elasticsearch",
    category: "Logs",
    description: "Future Elasticsearch log search integration.",
    status: "unknown",
    toolsetKey: "elasticsearch/data",
    verifyPrompt: "Check whether Elasticsearch is configured for Holmes. If not, explain the missing setup.",
    setupMarkdown: defaultSetup("elasticsearch")
  },
  {
    key: "datadog",
    title: "Datadog",
    category: "Future",
    description: "Future Datadog metrics and logs integration.",
    status: "unknown",
    toolsetKey: "datadog",
    verifyPrompt: "Check whether Datadog is configured for Holmes. If not, explain the missing setup.",
    setupMarkdown: defaultSetup("datadog")
  }
];

export async function seedDataSources() {
  for (const source of seeds) {
    await DataSource.updateOne({ key: source.key }, { $setOnInsert: source }, { upsert: true });
  }
}
