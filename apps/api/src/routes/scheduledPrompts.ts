import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { ScheduledPrompt } from "../models/ScheduledPrompt.js";
import { ScheduledPromptRun } from "../models/ScheduledPromptRun.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";
import {
  publicScheduledPrompt,
  refreshSchedules,
  runScheduledPrompt,
  scheduledPromptUpdate,
  validateCronExpression
} from "../services/schedulerService.js";

const router = Router();
const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");

const destinationSchema = z.object({
  type: z.enum(["none", "slackWebhook"]).default("none"),
  webhookUrl: z.string().url().optional().nullable()
});

const scheduledPromptSchema = z.object({
  title: z.string().min(1).max(180),
  prompt: z.string().min(1).max(20_000),
  cron: z.string().min(1).refine(validateCronExpression, "Invalid cron expression"),
  timezone: z.string().min(1).default("Asia/Ho_Chi_Minh"),
  enabled: z.boolean().default(true),
  model: z.string().optional(),
  destination: destinationSchema.default({ type: "none" })
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const prompts = await ScheduledPrompt.find().sort({ updatedAt: -1 });
    res.json({ scheduledPrompts: prompts.map(publicScheduledPrompt) });
  })
);

router.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = scheduledPromptSchema.parse(req.body);
    const prompt = await ScheduledPrompt.create({
      ...scheduledPromptUpdate(input),
      createdBy: req.user!._id
    });
    await refreshSchedules();
    res.status(201).json({ scheduledPrompt: publicScheduledPrompt(prompt) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = scheduledPromptSchema.partial().parse(req.body);
    const prompt = await ScheduledPrompt.findByIdAndUpdate(
      id,
      { $set: scheduledPromptUpdate(input) },
      { new: true }
    );
    if (!prompt) throw new ApiError(404, "Scheduled prompt not found");
    await refreshSchedules();
    res.json({ scheduledPrompt: publicScheduledPrompt(prompt) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const prompt = await ScheduledPrompt.findByIdAndDelete(id);
    if (!prompt) throw new ApiError(404, "Scheduled prompt not found");
    await refreshSchedules();
    res.json({ ok: true });
  })
);

router.post(
  "/:id/run",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const run = await runScheduledPrompt(id, "manual");
    if (!run) throw new ApiError(409, "Scheduled prompt is already running");
    res.status(201).json({ run });
  })
);

router.get(
  "/:id/runs",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const runs = await ScheduledPromptRun.find({ scheduledPromptId: id }).sort({ startedAt: -1 }).limit(50).lean();
    res.json({ runs });
  })
);

export default router;
