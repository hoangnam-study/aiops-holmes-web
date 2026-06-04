import { Router } from "express";
import { z } from "zod";
import { Feedback } from "../models/Feedback.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import type { AuthRequest } from "../middleware/auth.js";

const feedbackRoutes = Router();

const targetTypes = ["incident_rca", "chat_message"] as const;

const createSchema = z.object({
  targetType: z.enum(targetTypes),
  targetId: z.string().min(1).max(200),
  rating: z.enum(["up", "down"]),
  note: z.string().max(2000).optional()
});

const querySchema = z.object({
  targetType: z.enum(targetTypes),
  targetId: z.string().min(1).max(200)
});

// Upsert this user's feedback for the target, then return the current aggregate.
feedbackRoutes.post(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = createSchema.parse(req.body);
    if (!req.user) throw new ApiError(401, "Authentication required");
    const feedback = await Feedback.findOneAndUpdate(
      { targetType: input.targetType, targetId: input.targetId, createdBy: req.user._id },
      { $set: { rating: input.rating, note: input.note } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    const summary = await summarize(input.targetType, input.targetId);
    res.status(201).json({ feedback, summary });
  })
);

feedbackRoutes.get(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = querySchema.parse(req.query);
    const mine = req.user
      ? await Feedback.findOne({ targetType: input.targetType, targetId: input.targetId, createdBy: req.user._id }).lean()
      : null;
    const summary = await summarize(input.targetType, input.targetId);
    res.json({ mine, summary });
  })
);

async function summarize(targetType: (typeof targetTypes)[number], targetId: string) {
  const [up, down] = await Promise.all([
    Feedback.countDocuments({ targetType, targetId, rating: "up" }),
    Feedback.countDocuments({ targetType, targetId, rating: "down" })
  ]);
  return { up, down };
}

export default feedbackRoutes;
