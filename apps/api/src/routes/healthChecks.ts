import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { HealthCheck } from "../models/HealthCheck.js";
import { HealthCheckRun } from "../models/HealthCheckRun.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";
import { runHealthCheck } from "../services/healthCheckService.js";
import { recordAuditLog } from "../services/auditService.js";

const router = Router();
const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");
const healthCheckSchema = z.object({
  title: z.string().min(1).max(180),
  prompt: z.string().min(1).max(20_000),
  scope: z.string().max(500).optional().nullable(),
  labels: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  alertMode: z.enum(["none", "notify_on_failure", "always_notify"]).default("none")
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const healthChecks = await HealthCheck.find().sort({ updatedAt: -1 }).lean();
    res.json({ healthChecks });
  })
);

router.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = healthCheckSchema.parse(req.body);
    const healthCheck = await HealthCheck.create({ ...input, scope: input.scope || undefined, createdBy: req.user!._id });
    await recordAuditLog({
      actor: req.user,
      action: "health_check.created",
      targetType: "health_check",
      targetId: String(healthCheck._id),
      metadata: { title: healthCheck.title }
    });
    res.status(201).json({ healthCheck });
  })
);

router.patch(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = healthCheckSchema.partial().parse(req.body);
    const healthCheck = await HealthCheck.findByIdAndUpdate(id, { $set: { ...input, scope: input.scope || undefined } }, { new: true });
    if (!healthCheck) throw new ApiError(404, "Health check not found");
    await recordAuditLog({
      actor: req.user,
      action: "health_check.updated",
      targetType: "health_check",
      targetId: String(healthCheck._id),
      metadata: { title: healthCheck.title, enabled: healthCheck.enabled }
    });
    res.json({ healthCheck });
  })
);

router.delete(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const healthCheck = await HealthCheck.findByIdAndDelete(id);
    if (!healthCheck) throw new ApiError(404, "Health check not found");
    await HealthCheckRun.deleteMany({ healthCheckId: id });
    await recordAuditLog({
      actor: req.user,
      action: "health_check.deleted",
      targetType: "health_check",
      targetId: String(healthCheck._id),
      metadata: { title: healthCheck.title }
    });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/run",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const run = await runHealthCheck(id);
    if (!run) throw new ApiError(409, "Health check is already running");
    res.status(201).json({ run });
  })
);

router.get(
  "/:id/runs",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const runs = await HealthCheckRun.find({ healthCheckId: id }).sort({ startedAt: -1 }).limit(50).lean();
    res.json({ runs });
  })
);

export default router;
