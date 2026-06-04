import { describe, expect, it } from "vitest";
import { buildIncidentRcaPrompt } from "../services/incidentRcaService.js";

describe("incident RCA prompt builder", () => {
  it("includes incident context and attached alerts", () => {
    const prompt = buildIncidentRcaPrompt(
      {
        title: "Checkout pod is crash looping",
        status: "open",
        severity: "critical",
        source: "alertmanager",
        labels: {
          cluster: "prod",
          namespace: "payments",
          service: "checkout"
        },
        firstSeenAt: new Date("2026-06-04T04:00:00.000Z"),
        lastSeenAt: new Date("2026-06-04T04:05:00.000Z")
      },
      [
        {
          title: "PodCrashLooping",
          status: "firing",
          severity: "critical",
          description: "Container restarted repeatedly",
          labels: { pod: "checkout-7f9" },
          startsAt: new Date("2026-06-04T04:00:00.000Z")
        }
      ]
    );

    expect(prompt).toContain("Most likely root cause");
    expect(prompt).toContain("Checkout pod is crash looping");
    expect(prompt).toContain('"namespace":"payments"');
    expect(prompt).toContain("PodCrashLooping");
    expect(prompt).toContain("workload=checkout-7f9");
  });
});
