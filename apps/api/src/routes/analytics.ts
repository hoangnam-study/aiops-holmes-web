import { Router } from "express";
import { buildOverview } from "../services/analyticsService.js";
import { asyncHandler } from "../utils/errors.js";

const analyticsRoutes = Router();

analyticsRoutes.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const days = typeof req.query.days === "string" ? Number.parseInt(req.query.days, 10) : 30;
    const overview = await buildOverview(Number.isFinite(days) ? days : 30);
    res.json(overview);
  })
);

export default analyticsRoutes;
