import { Types } from "mongoose";
import { Incident } from "../models/Incident.js";
import { Runbook } from "../models/Runbook.js";
import { RunbookExecution } from "../models/RunbookExecution.js";
import { getHolmesConnection } from "./settingsService.js";
import { HolmesClient } from "./holmesClient.js";
import { buildAdditionalSystemPrompt } from "./knowledgeService.js";
import { withJobLock } from "./jobLockService.js";

export function buildRunbookExecutionPrompt(input: {
  title: string;
  content: string;
  scope?: string;
  incident?: { title: string; status: string; severity: string; rcaSummary?: string };
}) {
  return [
    "Execute this SRE runbook as a guided investigation.",
    "Return a checklist report with each step marked: completed, skipped, blocked, or needs human action.",
    "Include evidence, commands/tools used, risks, and final remediation advice.",
    "",
    input.scope ? `Scope: ${input.scope}` : "",
    input.incident ? `Incident: ${JSON.stringify(input.incident)}` : "",
    "",
    `Runbook: ${input.title}`,
    input.content
  ].filter(Boolean).join("\n");
}

export async function runRunbook(input: {
  runbookId: string;
  actorId: Types.ObjectId | string;
  incidentId?: string;
  scope?: string;
}) {
  return withJobLock(`runbook:${input.runbookId}`, 10 * 60 * 1000, async () => {
    const runbook = await Runbook.findById(input.runbookId);
    if (!runbook) throw new Error("Runbook not found");
    const incident = input.incidentId && Types.ObjectId.isValid(input.incidentId)
      ? await Incident.findById(input.incidentId)
      : null;
    const execution = await RunbookExecution.create({
      runbookId: runbook._id,
      incidentId: incident?._id,
      scope: input.scope,
      status: "running",
      startedAt: new Date(),
      createdBy: input.actorId
    });

    try {
      const connection = await getHolmesConnection();
      const response = await new HolmesClient(connection).chatToCompletion({
        ask: buildRunbookExecutionPrompt({
          title: runbook.title,
          content: runbook.content,
          scope: input.scope,
          incident: incident
            ? {
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
                rcaSummary: incident.rcaSummary
              }
            : undefined
        }),
        model: connection.defaultModel,
        request_source: "runbook_execution",
        source_ref: String(runbook._id),
        additional_system_prompt: await buildAdditionalSystemPrompt()
      });
      execution.status = "success";
      execution.completedAt = new Date();
      execution.report = response.analysis ?? "";
      execution.metadata = response.metadata ?? {};
      await execution.save();
      return execution;
    } catch (error) {
      execution.status = "error";
      execution.completedAt = new Date();
      execution.error = error instanceof Error ? error.message : String(error);
      await execution.save();
      return execution;
    }
  });
}
