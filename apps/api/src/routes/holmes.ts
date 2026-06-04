import { Router } from "express";
import { asyncHandler } from "../utils/errors.js";
import { HolmesClient } from "../services/holmesClient.js";
import { getHolmesConnection } from "../services/settingsService.js";

const router = Router();

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const connection = await getHolmesConnection();
    const status = await new HolmesClient(connection).status();
    res.json({ ...status, defaultModel: connection.defaultModel, baseUrl: connection.baseUrl });
  })
);

router.get(
  "/models",
  asyncHandler(async (_req, res) => {
    const connection = await getHolmesConnection();
    let models: string[] = [];
    let error: string | undefined;
    try {
      models = await new HolmesClient(connection).listModels();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    // Always keep the configured default selectable, even if Holmes is unreachable
    // or omits it from the list.
    if (connection.defaultModel && !models.includes(connection.defaultModel)) {
      models = [connection.defaultModel, ...models];
    }
    res.json({ models, defaultModel: connection.defaultModel, error });
  })
);

export default router;
