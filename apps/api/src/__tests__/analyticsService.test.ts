import { describe, expect, it } from "vitest";
import { buildDateBuckets, mergeTimeseries } from "../services/analyticsService.js";

describe("buildDateBuckets", () => {
  it("returns one inclusive UTC bucket per day", () => {
    const buckets = buildDateBuckets(new Date("2026-06-01T10:00:00Z"), new Date("2026-06-04T01:00:00Z"));
    expect(buckets).toEqual(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"]);
  });

  it("returns a single bucket when since and now are the same day", () => {
    expect(buildDateBuckets(new Date("2026-06-04T00:00:00Z"), new Date("2026-06-04T23:59:59Z"))).toEqual(["2026-06-04"]);
  });
});

describe("mergeTimeseries", () => {
  it("zero-fills missing days and aligns counts", () => {
    const dates = ["2026-06-01", "2026-06-02", "2026-06-03"];
    const incidents = new Map([
      ["2026-06-01", 2],
      ["2026-06-03", 5]
    ]);
    const alerts = new Map([["2026-06-02", 7]]);
    expect(mergeTimeseries(dates, incidents, alerts)).toEqual([
      { date: "2026-06-01", incidents: 2, alerts: 0 },
      { date: "2026-06-02", incidents: 0, alerts: 7 },
      { date: "2026-06-03", incidents: 5, alerts: 0 }
    ]);
  });
});
