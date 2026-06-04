import { describe, expect, it } from "vitest";
import { validateCronExpression } from "../services/schedulerService.js";

describe("scheduler validation", () => {
  it("accepts valid cron expressions", () => {
    expect(validateCronExpression("0 10 * * 1")).toBe(true);
  });

  it("rejects invalid cron expressions", () => {
    expect(validateCronExpression("not a cron")).toBe(false);
  });
});
