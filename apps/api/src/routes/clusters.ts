import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Agent } from "../models/Agent.js";
import { Cluster } from "../models/Cluster.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { recordAuditLog } from "../services/auditService.js";

export const clusterRoutes = Router();
export const agentRoutes = Router();

const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");
const clusterSchema = z.object({
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/),
  environment: z.string().max(120).optional().nullable(),
  apiUrl: z.string().url().optional().nullable()
});
const heartbeatSchema = z.object({
  clusterSlug: z.string().min(1),
  agentId: z.string().min(1).max(160),
  version: z.string().optional(),
  status: z.enum(["healthy", "degraded", "offline"]).default("healthy"),
  metadata: z.record(z.string(), z.unknown()).default({})
});

clusterRoutes.get(
  "/",
  asyncHandler(async (_req, res) => {
    const clusters = await Cluster.find().sort({ updatedAt: -1 }).lean();
    res.json({ clusters });
  })
);

clusterRoutes.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = clusterSchema.parse(req.body);
    const token = randomBytes(24).toString("hex");
    const cluster = await Cluster.create({
      ...input,
      environment: input.environment || undefined,
      apiUrl: input.apiUrl || undefined,
      enrollmentTokenEncrypted: encryptSecret(token),
      createdBy: req.user!._id
    });
    await recordAuditLog({
      actor: req.user,
      action: "cluster.created",
      targetType: "cluster",
      targetId: String(cluster._id),
      metadata: { slug: cluster.slug }
    });
    res.status(201).json({ cluster, enrollmentToken: token });
  })
);

clusterRoutes.patch(
  "/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = clusterSchema.partial().parse(req.body);
    const cluster = await Cluster.findByIdAndUpdate(
      id,
      { $set: { ...input, environment: input.environment || undefined, apiUrl: input.apiUrl || undefined } },
      { new: true }
    );
    if (!cluster) throw new ApiError(404, "Cluster not found");
    await recordAuditLog({
      actor: req.user,
      action: "cluster.updated",
      targetType: "cluster",
      targetId: String(cluster._id),
      metadata: { slug: cluster.slug }
    });
    res.json({ cluster });
  })
);

clusterRoutes.post(
  "/:id/enrollment-token",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const token = randomBytes(24).toString("hex");
    const cluster = await Cluster.findByIdAndUpdate(id, { $set: { enrollmentTokenEncrypted: encryptSecret(token) } }, { new: true });
    if (!cluster) throw new ApiError(404, "Cluster not found");
    await recordAuditLog({
      actor: req.user,
      action: "cluster.token_rotated",
      targetType: "cluster",
      targetId: String(cluster._id),
      metadata: { slug: cluster.slug }
    });
    res.json({ cluster, enrollmentToken: token });
  })
);

clusterRoutes.get(
  "/:id/agents",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const agents = await Agent.find({ clusterId: id }).sort({ lastHeartbeatAt: -1 }).lean();
    res.json({ agents });
  })
);

agentRoutes.post(
  "/heartbeat",
  asyncHandler(async (req, res) => {
    const input = heartbeatSchema.parse(req.body);
    const token = typeof req.headers["x-agent-token"] === "string" ? req.headers["x-agent-token"] : "";
    const cluster = await Cluster.findOne({ slug: input.clusterSlug });
    if (!cluster) throw new ApiError(404, "Cluster not found");
    if (!token || decryptSecret(cluster.enrollmentTokenEncrypted) !== token) throw new ApiError(401, "Invalid agent token");

    const now = new Date();
    const agent = await Agent.findOneAndUpdate(
      { clusterId: cluster._id, agentId: input.agentId },
      {
        $set: {
          version: input.version,
          status: input.status,
          metadata: input.metadata,
          lastHeartbeatAt: now
        }
      },
      { upsert: true, new: true }
    );
    cluster.status = input.status === "healthy" ? "healthy" : "degraded";
    cluster.lastHeartbeatAt = now;
    await cluster.save();
    res.json({ ok: true, clusterId: String(cluster._id), agentId: agent.agentId });
  })
);
