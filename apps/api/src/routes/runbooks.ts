import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Runbook } from "../models/Runbook.js";
import { RunbookExecution } from "../models/RunbookExecution.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";
import { recordAuditLog } from "../services/auditService.js";
import { runRunbook } from "../services/runbookService.js";

const router = Router();
const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");
const runbookSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(1000).optional().nullable(),
  content: z.string().min(1).max(80_000),
  source: z.enum(["manual", "git", "uploaded"]).default("manual"),
  sourceRef: z.string().optional().nullable(),
  matchers: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});
const executeSchema = z.object({
  incidentId: objectId.optional(),
  scope: z.string().max(500).optional()
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.search === "string" && req.query.search.trim()) filter.$text = { $search: req.query.search.trim() };
    const runbooks = await Runbook.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    res.json({ runbooks });
  })
);

router.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = runbookSchema.parse(req.body);
    const runbook = await Runbook.create({
      ...input,
      description: input.description || undefined,
      sourceRef: input.sourceRef || undefined,
      createdBy: req.user!._id
    });
    await recordAuditLog({
      actor: req.user,
      action: "runbook.created",
      targetType: "runbook",
      targetId: String(runbook._id),
      metadata: { title: runbook.title }
    });
    res.status(201).json({ runbook });
  })
);

router.patch(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = runbookSchema.partial().parse(req.body);
    const runbook = await Runbook.findByIdAndUpdate(
      id,
      { $set: { ...input, description: input.description || undefined, sourceRef: input.sourceRef || undefined } },
      { new: true }
    );
    if (!runbook) throw new ApiError(404, "Runbook not found");
    await recordAuditLog({
      actor: req.user,
      action: "runbook.updated",
      targetType: "runbook",
      targetId: String(runbook._id),
      metadata: { title: runbook.title, enabled: runbook.enabled }
    });
    res.json({ runbook });
  })
);

router.delete(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const runbook = await Runbook.findByIdAndDelete(id);
    if (!runbook) throw new ApiError(404, "Runbook not found");
    await RunbookExecution.deleteMany({ runbookId: id });
    await recordAuditLog({
      actor: req.user,
      action: "runbook.deleted",
      targetType: "runbook",
      targetId: String(runbook._id),
      metadata: { title: runbook.title }
    });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/execute",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = executeSchema.parse(req.body);
    const execution = await runRunbook({
      runbookId: id,
      actorId: req.user!._id as Types.ObjectId,
      incidentId: input.incidentId,
      scope: input.scope
    });
    res.status(201).json({ execution });
  })
);

router.get(
  "/:id/executions",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const executions = await RunbookExecution.find({ runbookId: id }).sort({ startedAt: -1 }).limit(50).lean();
    res.json({ executions });
  })
);

export default router;
