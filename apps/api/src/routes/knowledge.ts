import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { KnowledgeEntry } from "../models/KnowledgeEntry.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";

const router = Router();

const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");
const entrySchema = z.object({
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(20_000),
  scope: z.enum(["global", "personal", "agent"]).default("global"),
  type: z.enum(["instruction", "skill"]).default("instruction"),
  enabled: z.boolean().default(true),
  tags: z.array(z.string().min(1)).default([])
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    const filter = scope && ["global", "personal", "agent"].includes(scope) ? { scope } : {};
    const entries = await KnowledgeEntry.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ entries });
  })
);

router.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = entrySchema.parse(req.body);
    const entry = await KnowledgeEntry.create({ ...input, createdBy: req.user!._id });
    res.status(201).json({ entry });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = entrySchema.partial().parse(req.body);
    const entry = await KnowledgeEntry.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!entry) throw new ApiError(404, "Knowledge entry not found");
    res.json({ entry });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const entry = await KnowledgeEntry.findByIdAndDelete(id);
    if (!entry) throw new ApiError(404, "Knowledge entry not found");
    res.json({ ok: true });
  })
);

export default router;
