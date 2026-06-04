import { describe, expect, it } from "vitest";
import { incidentKeyFromLabels, normalizeAlertmanagerPayload } from "../services/alertIngestService.js";

describe("alert ingest normalization", () => {
  it("normalizes Alertmanager payloads into grouped alerts", () => {
    const alerts = normalizeAlertmanagerPayload({
      receiver: "sre-platform",
      alerts: [
        {
          status: "firing",
          labels: {
            alertname: "PodCrashLooping",
            cluster: "prod",
            namespace: "payments",
            pod: "checkout-7f9",
            severity: "critical"
          },
          annotations: {
            summary: "Checkout pod is crash looping",
            description: "Container restarted repeatedly"
          },
          startsAt: "2026-06-04T04:00:00.000Z",
          fingerprint: "abc123"
        }
      ]
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      fingerprint: "abc123",
      status: "firing",
      severity: "critical",
      source: "sre-platform",
      title: "Checkout pod is crash looping",
      description: "Container restarted repeatedly",
      incidentKey: "prod:payments:podcrashlooping:checkout-7f9"
    });
  });

  it("uses stable fallback grouping from labels", () => {
    expect(
      incidentKeyFromLabels({
        cluster: "prod",
        namespace: "checkout",
        alertname: "HighLatency",
        service: "api"
      })
    ).toBe("prod:checkout:highlatency:api");
  });
});
