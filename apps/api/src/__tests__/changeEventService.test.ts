import { describe, expect, it } from "vitest";
import {
  buildChangeContext,
  changeMatchesIncidentLabels,
  normalizeChangeEvent,
  workloadFromLabels
} from "../services/changeEventService.js";

describe("change event normalization", () => {
  it("normalizes an ArgoCD-style deploy payload", () => {
    const change = normalizeChangeEvent({
      type: "sync",
      summary: "Synced checkout to v2.3.1",
      cluster: "prod",
      namespace: "payments",
      app: "checkout",
      revision: "v2.3.1",
      previousVersion: "v2.3.0",
      actor: "ci-bot",
      source: "argocd",
      url: "https://argo.example.com/app/checkout",
      timestamp: "2026-06-04T04:00:00.000Z"
    });

    expect(change).toMatchObject({
      kind: "deploy",
      title: "Synced checkout to v2.3.1",
      cluster: "prod",
      namespace: "payments",
      workload: "checkout",
      version: "v2.3.1",
      previousVersion: "v2.3.0",
      author: "ci-bot",
      source: "argocd",
      link: "https://argo.example.com/app/checkout"
    });
    expect(change.occurredAt.toISOString()).toBe("2026-06-04T04:00:00.000Z");
  });

  it("derives a workload and title when only labels are provided", () => {
    const change = normalizeChangeEvent({
      kind: "image_change",
      labels: { namespace: "checkout", deployment: "api", version: "1.4.0" },
      source: "kubernetes"
    });
    expect(change.namespace).toBe("checkout");
    expect(change.workload).toBe("api");
    expect(change.title).toContain("image change");
  });

  it("defaults source to manual and occurredAt to now when missing", () => {
    const before = Date.now();
    const change = normalizeChangeEvent({ title: "Manual rollback" });
    expect(change.source).toBe("manual");
    expect(change.kind).toBe("other");
    expect(change.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("workloadFromLabels", () => {
  it("prefers explicit workload over service/deployment", () => {
    expect(workloadFromLabels({ workload: "w", service: "s", deployment: "d" })).toBe("w");
    expect(workloadFromLabels({ deployment: "d", pod: "p" })).toBe("d");
    expect(workloadFromLabels({})).toBeUndefined();
  });
});

describe("changeMatchesIncidentLabels", () => {
  it("matches on cluster + namespace + workload", () => {
    expect(
      changeMatchesIncidentLabels(
        { cluster: "prod", namespace: "payments", workload: "checkout" },
        { cluster: "prod", namespace: "payments", deployment: "checkout" }
      )
    ).toBe(true);
  });

  it("requires namespace on both sides", () => {
    expect(
      changeMatchesIncidentLabels({ cluster: "prod", namespace: undefined, workload: "checkout" }, { namespace: "payments" })
    ).toBe(false);
    expect(
      changeMatchesIncidentLabels({ namespace: "payments", workload: "checkout" }, { cluster: "prod" })
    ).toBe(false);
  });

  it("rejects a different cluster or workload", () => {
    expect(
      changeMatchesIncidentLabels(
        { cluster: "staging", namespace: "payments", workload: "checkout" },
        { cluster: "prod", namespace: "payments" }
      )
    ).toBe(false);
    expect(
      changeMatchesIncidentLabels(
        { namespace: "payments", workload: "checkout" },
        { namespace: "payments", deployment: "billing" }
      )
    ).toBe(false);
  });

  it("matches when one side has no workload", () => {
    expect(
      changeMatchesIncidentLabels({ namespace: "payments", workload: "checkout" }, { namespace: "payments" })
    ).toBe(true);
  });
});

describe("buildChangeContext", () => {
  it("returns an empty string with no changes", () => {
    expect(buildChangeContext([])).toBe("");
  });

  it("renders a version transition line", () => {
    const context = buildChangeContext([
      {
        kind: "deploy",
        title: "Deploy checkout",
        workload: "checkout",
        version: "v2",
        previousVersion: "v1",
        author: "ci-bot",
        source: "argocd",
        occurredAt: new Date("2026-06-04T04:00:00.000Z")
      }
    ]);
    expect(context).toContain("likely root causes");
    expect(context).toContain("version=v1->v2");
    expect(context).toContain("workload=checkout");
  });
});
