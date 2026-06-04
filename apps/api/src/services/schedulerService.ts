import cron, { type ScheduledTask } from "node-cron";
import { ScheduledPrompt } from "../models/ScheduledPrompt.js";
import type { ScheduledPromptDoc } from "../models/ScheduledPrompt.js";
import { ScheduledPromptRun } from "../models/ScheduledPromptRun.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { getHolmesConnection } from "./settingsService.js";
import { HolmesClient } from "./holmesClient.js";
import { buildAdditionalSystemPrompt } from "./knowledgeService.js";
import { withJobLock } from "./jobLockService.js";

const tasks = new Map<string, ScheduledTask>();
let refreshTimer: NodeJS.Timeout | undefined;

export function validateCronExpression(expression: string) {
  return cron.validate(expression);
}

export function publicScheduledPrompt(prompt: ScheduledPromptDoc & { _id: unknown; toObject: () => Record<string, any> }) {
  const obj = prompt.toObject();
  const destination = {
    type: obj.destination?.type ?? "none",
    hasWebhook: Boolean(obj.destination?.webhookUrlEncrypted)
  };
  return {
    ...obj,
    destination,
    _id: String(obj._id),
    createdBy: String(obj.createdBy)
  };
}

export function scheduledPromptUpdate(input: {
  title?: string;
  prompt?: string;
  cron?: string;
  timezone?: string;
  enabled?: boolean;
  model?: string;
  destination?: { type: "none" | "slackWebhook"; webhookUrl?: string | null };
}) {
  const update: Record<string, unknown> = {};
  for (const field of ["title", "prompt", "cron", "timezone", "enabled", "model"] as const) {
    if (input[field] !== undefined) update[field] = input[field];
  }
  if (input.destination) {
    update.destination = {
      type: input.destination.type,
      webhookUrlEncrypted:
        input.destination.type === "slackWebhook" && input.destination.webhookUrl
          ? encryptSecret(input.destination.webhookUrl)
          : null
    };
  }
  return update;
}

async function sendSlackWebhook(url: string | null, text: string) {
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000)
  });
}

export async function runScheduledPrompt(promptId: string, trigger: "manual" | "scheduled") {
  return withJobLock(`scheduled-prompt:${promptId}`, 10 * 60 * 1000, async () => {
    const prompt = await ScheduledPrompt.findById(promptId);
    if (!prompt) throw new Error("Scheduled prompt not found");

    const run = await ScheduledPromptRun.create({
      scheduledPromptId: prompt._id,
      status: "running",
      trigger,
      startedAt: new Date(),
      toolEvents: []
    });
    prompt.lastRunAt = run.startedAt;
    prompt.lastStatus = "running";
    await prompt.save();

    try {
      const connection = await getHolmesConnection();
      const client = new HolmesClient(connection);
      const additionalSystemPrompt = await buildAdditionalSystemPrompt();
      const response = await client.chat({
        ask: prompt.prompt,
        model: prompt.model || connection.defaultModel,
        request_source: "scheduled_prompt",
        source_ref: String(prompt._id),
        additional_system_prompt: additionalSystemPrompt
      });

      run.status = "success";
      run.completedAt = new Date();
      run.answer = response.analysis ?? "";
      run.metadata = response.metadata ?? {};
      run.toolEvents = response.tool_calls ?? [];
      await run.save();

      prompt.lastStatus = "success";
      prompt.lastRunAt = run.completedAt;
      await prompt.save();

      if (prompt.destination?.type === "slackWebhook") {
        await sendSlackWebhook(decryptSecret(prompt.destination.webhookUrlEncrypted), `*${prompt.title}*\n${run.answer}`);
      }

      return run;
    } catch (error) {
      run.status = "error";
      run.completedAt = new Date();
      run.error = error instanceof Error ? error.message : String(error);
      await run.save();

      prompt.lastStatus = "error";
      prompt.lastRunAt = run.completedAt;
      await prompt.save();
      return run;
    }
  });
}

export async function refreshSchedules() {
  const prompts = await ScheduledPrompt.find({ enabled: true }).lean();
  const expected = new Set(prompts.map((prompt) => String(prompt._id)));

  for (const [id, task] of tasks.entries()) {
    if (!expected.has(id)) {
      task.stop();
      tasks.delete(id);
    }
  }

  for (const prompt of prompts) {
    const id = String(prompt._id);
    if (tasks.has(id) || !cron.validate(prompt.cron)) continue;
    const task = cron.schedule(
      prompt.cron,
      () => {
        void runScheduledPrompt(id, "scheduled");
      },
      { timezone: prompt.timezone }
    );
    tasks.set(id, task);
  }
}

export function startScheduler() {
  void refreshSchedules();
  refreshTimer = setInterval(() => void refreshSchedules(), 30_000);
}

export function stopScheduler() {
  if (refreshTimer) clearInterval(refreshTimer);
  for (const task of tasks.values()) task.stop();
  tasks.clear();
}
