import { HealthCheck } from "../models/HealthCheck.js";
import { HealthCheckRun } from "../models/HealthCheckRun.js";
import { getHolmesConnection } from "./settingsService.js";
import { HolmesClient } from "./holmesClient.js";
import { buildAdditionalSystemPrompt } from "./knowledgeService.js";
import { withJobLock } from "./jobLockService.js";

export async function runHealthCheck(healthCheckId: string) {
  return withJobLock(`health-check:${healthCheckId}`, 10 * 60 * 1000, async () => {
    const healthCheck = await HealthCheck.findById(healthCheckId);
    if (!healthCheck) throw new Error("Health check not found");

    const run = await HealthCheckRun.create({
      healthCheckId: healthCheck._id,
      status: "running",
      startedAt: new Date()
    });
    healthCheck.lastRunAt = run.startedAt;
    healthCheck.lastStatus = "running";
    await healthCheck.save();

    try {
      const connection = await getHolmesConnection();
      const response = await new HolmesClient(connection).chat({
        ask: [
          "Run this Holmes Health Check and return pass/fail evidence, risk, and remediation.",
          healthCheck.scope ? `Scope: ${healthCheck.scope}` : "",
          `Check: ${healthCheck.prompt}`
        ].filter(Boolean).join("\n\n"),
        model: connection.defaultModel,
        request_source: "health_check",
        source_ref: String(healthCheck._id),
        additional_system_prompt: await buildAdditionalSystemPrompt()
      });
      run.status = "success";
      run.completedAt = new Date();
      run.answer = response.analysis ?? "";
      run.metadata = response.metadata ?? {};
      await run.save();
      healthCheck.lastStatus = "success";
      healthCheck.lastRunAt = run.completedAt;
      await healthCheck.save();
      return run;
    } catch (error) {
      run.status = "error";
      run.completedAt = new Date();
      run.error = error instanceof Error ? error.message : String(error);
      await run.save();
      healthCheck.lastStatus = "error";
      healthCheck.lastRunAt = run.completedAt;
      await healthCheck.save();
      return run;
    }
  });
}
