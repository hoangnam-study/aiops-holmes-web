import { describe, expect, it } from "vitest";
import { formatIncidentNotification } from "../services/notificationService.js";

describe("notification formatting", () => {
  it("formats incident RCA notifications with severity and summary", () => {
    const text = formatIncidentNotification("rca_completed", {
      _id: "incident-1",
      title: "Checkout pod is crash looping",
      status: "open",
      severity: "critical",
      source: "alertmanager",
      labels: {
        cluster: "prod",
        namespace: "payments"
      },
      alertCount: 2,
      rcaStatus: "completed",
      rcaSummary: "Most likely cause is a bad image rollout.",
      firstSeenAt: new Date("2026-06-04T04:00:00.000Z"),
      lastSeenAt: new Date("2026-06-04T04:05:00.000Z"),
      createdAt: new Date("2026-06-04T04:00:00.000Z"),
      updatedAt: new Date("2026-06-04T04:05:00.000Z")
    });

    expect(text).toContain("RCA COMPLETED");
    expect(text).toContain("Checkout pod is crash looping");
    expect(text).toContain("Severity: critical");
    expect(text).toContain("prod / payments");
    expect(text).toContain("bad image rollout");
  });
});
