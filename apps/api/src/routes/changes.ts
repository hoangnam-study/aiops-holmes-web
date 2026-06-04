import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { ChangeEvent } from "../models/ChangeEvent.js";
import { env } from "../config/env.js";
import { normalizeChangeEvent, recordChangeEvent } from "../services/changeEventService.js";
import { recordAuditLog } from "../services/auditService.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";

export const changeWebhookRoutes = Router();
export const changeRoutes = Router();

const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");

function assertIngestToken(req: { headers: Record<string, unknown>; query: Record<string, unknown> }) {
  if (!env.CHANGE_INGEST_TOKEN) return;
  const header = typeof req.headers["x-change-ingest-token"] === "string" ? req.headers["x-change-ingest-token"] : "";
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  if (![header, bearer, queryToken].includes(env.CHANGE_INGEST_TOKEN)) {
    throw new ApiError(401, "Invalid change ingest token");
  }
}

function extractChangePayloads(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (Array.isArray(root.changes)) return root.changes;
  if (Array.isArray(root.events)) return root.events;
  return [body];
}

changeWebhookRoutes.post(
  "/event",
  asyncHandler(async (req, res) => {
    assertIngestToken(req);
    const payloads = extractChangePayloads(req.body);
    const results = [];
    for (const payload of payloads) {
      const normalized = normalizeChangeEvent(payload);
      results.push(await recordChangeEvent(normalized));
    }
    res.status(202).json({
      ok: true,
      accepted: results.length,
      changeIds: results.map((result) => result.changeId),
      correlatedIncidentIds: [...new Set(results.flatMap((result) => result.incidentIds))]
    });
  })
);

const manualChangeSchema = z.object({
  kind: z.enum(["deploy", "config_change", "scale", "rollback", "image_change", "feature_flag", "other"]).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  cluster: z.string().max(160).optional(),
  namespace: z.string().max(160).optional(),
  workload: z.string().max(200).optional(),
  service: z.string().max(200).optional(),
  author: z.string().max(160).optional(),
  source: z.string().max(120).optional(),
  version: z.string().max(200).optional(),
  previousVersion: z.string().max(200).optional(),
  link: z.string().url().max(2000).optional(),
  occurredAt: z.string().datetime().optional(),
  labels: z.record(z.string(), z.string()).optional()
});

changeRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.kind === "string") filter.kind = req.query.kind;
    if (typeof req.query.namespace === "string") filter.namespace = req.query.namespace;
    if (typeof req.query.cluster === "string") filter.cluster = req.query.cluster;
    if (typeof req.query.incidentId === "string" && Types.ObjectId.isValid(req.query.incidentId)) {
      filter.incidentIds = req.query.incidentId;
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.$text = { $search: req.query.search.trim() };
    }
    const changes = await ChangeEvent.find(filter).sort({ occurredAt: -1, createdAt: -1 }).limit(200).lean();
    res.json({ changes });
  })
);

changeRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const change = await ChangeEvent.findById(id).lean();
    if (!change) throw new ApiError(404, "Change not found");
    res.json({ change });
  })
);

changeRoutes.post(
  "/",
  requireRole("admin", "operator"),
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = manualChangeSchema.parse(req.body);
    const normalized = normalizeChangeEvent({ ...input, source: input.source ?? "manual" });
    const result = await recordChangeEvent(normalized, req.user ? String(req.user._id) : undefined);
    await recordAuditLog({
      actor: req.user,
      action: "change.created",
      targetType: "change",
      targetId: result.changeId,
      metadata: { kind: normalized.kind, namespace: normalized.namespace, workload: normalized.workload }
    });
    const change = await ChangeEvent.findById(result.changeId).lean();
    res.status(201).json({ change, correlatedIncidentIds: result.incidentIds });
  })
);

changeRoutes.delete(
  "/:id",
  requireRole("admin", "operator"),
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const change = await ChangeEvent.findByIdAndDelete(id);
    if (!change) throw new ApiError(404, "Change not found");
    await recordAuditLog({
      actor: req.user,
      action: "change.deleted",
      targetType: "change",
      targetId: id
    });
    res.json({ ok: true });
  })
);
