import { Router } from "express";
import { z } from "zod";
import { DataSource } from "../models/DataSource.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { getHolmesConnection } from "../services/settingsService.js";
import { HolmesClient } from "../services/holmesClient.js";
import { buildAdditionalSystemPrompt } from "../services/knowledgeService.js";

const router = Router();
const keySchema = z.string().min(1);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const dataSources = await DataSource.find().sort({ category: 1, title: 1 }).lean();
    res.json({ dataSources });
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
