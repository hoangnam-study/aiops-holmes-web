import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { NotificationDelivery } from "../models/NotificationDelivery.js";
import { NotificationSink } from "../models/NotificationSink.js";
import { RoutingRule } from "../models/RoutingRule.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";
import { notificationSinkUpdate, publicNotificationSink } from "../services/notificationService.js";

const router = Router();
const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");

const sinkSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(["webhook", "slackWebhook", "teamsWebhook"]),
  enabled: z.boolean().default(true),
  url: z.string().url().optional().nullable(),
  clearUrl: z.boolean().optional()
});

const ruleSchema = z.object({
  name: z.string().min(1).max(160),
  enabled: z.boolean().default(true),
  eventType: z.enum(["alert_ingested", "rca_completed", "rca_failed", "incident_status_changed"]),
  sinkId: objectId,
  severity: z.enum(["critical", "warning", "info", "unknown", "any"]).default("any"),
  status: z.string().optional()
});

router.get(
  "/sinks",
  asyncHandler(async (_req, res) => {
    const sinks = await NotificationSink.find().sort({ updatedAt: -1 });
    res.json({ sinks: sinks.map(publicNotificationSink) });
  })
);

router.post(
  "/sinks",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = sinkSchema.parse(req.body);
    const sink = await NotificationSink.create({
      ...notificationSinkUpdate(input),
      createdBy: req.user!._id
    });
    res.status(201).json({ sink: publicNotificationSink(sink) });
  })
);

router.patch(
  "/sinks/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = sinkSchema.partial().parse(req.body);
    const sink = await NotificationSink.findByIdAndUpdate(id, { $set: notificationSinkUpdate(input) }, { new: true });
    if (!sink) throw new ApiError(404, "Notification sink not found");
    res.json({ sink: publicNotificationSink(sink) });
  })
);

router.delete(
  "/sinks/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const sink = await NotificationSink.findByIdAndDelete(id);
    if (!sink) throw new ApiError(404, "Notification sink not found");
    await RoutingRule.deleteMany({ sinkId: id });
    res.json({ ok: true });
  })
);

router.get(
  "/rules",
  asyncHandler(async (_req, res) => {
    const rules = await RoutingRule.find().sort({ updatedAt: -1 }).lean();
    res.json({ rules });
  })
);

router.post(
  "/rules",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = ruleSchema.parse(req.body);
    const sink = await NotificationSink.findById(input.sinkId);
    if (!sink) throw new ApiError(404, "Notification sink not found");
    const rule = await RoutingRule.create({ ...input, createdBy: req.user!._id });
    res.status(201).json({ rule });
  })
);

router.patch(
  "/rules/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = ruleSchema.partial().parse(req.body);
    const rule = await RoutingRule.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!rule) throw new ApiError(404, "Routing rule not found");
    res.json({ rule });
  })
);

router.delete(
  "/rules/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const rule = await RoutingRule.findByIdAndDelete(id);
    if (!rule) throw new ApiError(404, "Routing rule not found");
    res.json({ ok: true });
  })
);

router.get(
  "/deliveries",
  asyncHandler(async (_req, res) => {
    const deliveries = await NotificationDelivery.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ deliveries });
  })
);

export default router;
