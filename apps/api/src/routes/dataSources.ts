import { Router } from "express";
import { z } from "zod";
import { DataSource } from "../models/DataSource.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { getHolmesConnection } from "../services/settingsService.js";
import { HolmesClient } from "../services/holmesClient.js";
import { buildAdditionalSystemPrompt } from "../services/knowledgeService.js";
import { recordAuditLog } from "../services/auditService.js";
import { type AuthRequest } from "../middleware/auth.js";

const router = Router();
const keySchema = z.string().min(1);
const dataSourceSchema = z.object({
  key: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1).max(180),
  category: z.enum(["Kubernetes", "Metrics", "Logs", "Traces", "Profiles", "Dashboards", "Cloud", "ITSM", "SCM", "Database", "Queue", "CI/CD", "Custom", "Future"]),
  description: z.string().min(1).max(1000),
  status: z.enum(["connected", "configured", "unknown", "failed"]).default("unknown"),
  enabled: z.boolean().default(true),
  toolsetKey: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  docsUrl: z.string().url().optional().or(z.literal("")),
  configSchema: z.record(z.string(), z.unknown()).optional(),
  secretFields: z.array(z.string()).default([]),
  verifyPrompt: z.string().min(1).max(20_000),
  setupMarkdown: z.string().min(1).max(20_000)
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const dataSources = await DataSource.find().sort({ category: 1, title: 1 }).lean();
    res.json({ dataSources });
  })
);

router.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = dataSourceSchema.parse(req.body);
    const existing = await DataSource.findOne({ key: input.key });
    if (existing) throw new ApiError(409, "Data source already exists");
    const dataSource = await DataSource.create({ ...input, docsUrl: input.docsUrl || undefined });
    await recordAuditLog({
      actor: req.user,
      action: "data_source.created",
      targetType: "data_source",
      targetId: dataSource.key,
      metadata: { title: dataSource.title, category: dataSource.category }
    });
    res.status(201).json({ dataSource });
  })
);

router.patch(
  "/:key",
  asyncHandler<AuthRequest>(async (req, res) => {
    const key = keySchema.parse(req.params.key);
    const input = dataSourceSchema.partial().omit({ key: true }).parse(req.body);
    const dataSource = await DataSource.findOneAndUpdate(
      { key },
      { $set: { ...input, docsUrl: input.docsUrl || undefined } },
      { new: true }
    );
    if (!dataSource) throw new ApiError(404, "Data source not found");
    await recordAuditLog({
      actor: req.user,
      action: "data_source.updated",
      targetType: "data_source",
      targetId: dataSource.key,
      metadata: { title: dataSource.title, enabled: dataSource.enabled }
    });
    res.json({ dataSource });
  })
);

router.delete(
  "/:key",
  asyncHandler<AuthRequest>(async (req, res) => {
    const key = keySchema.parse(req.params.key);
    const dataSource = await DataSource.findOneAndDelete({ key });
    if (!dataSource) throw new ApiError(404, "Data source not found");
    await recordAuditLog({
      actor: req.user,
      action: "data_source.deleted",
      targetType: "data_source",
      targetId: dataSource.key,
      metadata: { title: dataSource.title }
    });
    res.json({ ok: true });
  })
);

router.get(
  "/:key/setup",
  asyncHandler(async (req, res) => {
    const key = keySchema.parse(req.params.key);
    const dataSource = await DataSource.findOne({ key }).lean();
    if (!dataSource) throw new ApiError(404, "Data source not found");
    res.json({ key, setupMarkdown: dataSource.setupMarkdown });
  })
);

router.post(
  "/:key/verify",
  asyncHandler(async (req, res) => {
    const key = keySchema.parse(req.params.key);
    const dataSource = await DataSource.findOne({ key });
    if (!dataSource) throw new ApiError(404, "Data source not found");
    if (!dataSource.enabled) throw new ApiError(409, "Data source is disabled");

    const connection = await getHolmesConnection();
    const client = new HolmesClient(connection);
    try {
      const response = await client.chat({
        ask: dataSource.verifyPrompt,
        model: connection.defaultModel,
        request_source: "datasource_verification",
        source_ref: dataSource.key,
        additional_system_prompt: await buildAdditionalSystemPrompt()
      });
      dataSource.status = "connected";
      dataSource.lastVerifiedAt = new Date();
      dataSource.verificationMessage = response.analysis ?? "Verified";
      await dataSource.save();
      res.json({ dataSource, result: response });
    } catch (error) {
      dataSource.status = "failed";
      dataSource.lastVerifiedAt = new Date();
      dataSource.verificationMessage = error instanceof Error ? error.message : String(error);
      await dataSource.save();
      res.status(502).json({ dataSource, error: dataSource.verificationMessage });
    }
  })
);

export default router;
