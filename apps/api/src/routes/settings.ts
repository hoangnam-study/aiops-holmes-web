import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { getHolmesConnection, getSettings, toPublicSettings, updateSettings } from "../services/settingsService.js";
import { HolmesClient } from "../services/holmesClient.js";
import { updateAdminPassword } from "../services/adminService.js";
import { recordAuditLog } from "../services/auditService.js";

const router = Router();

const patchSchema = z.object({
  holmesApiUrl: z.string().url().optional(),
  holmesApiKey: z.string().optional().nullable(),
  clearHolmesApiKey: z.boolean().optional(),
  defaultModel: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newAdminPassword: z.string().min(8).optional()
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({ settings: toPublicSettings(settings) });
  })
);

router.patch(
  "/",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = patchSchema.parse(req.body);
    if (input.newAdminPassword) {
      if (!input.currentPassword) throw new ApiError(400, "Current password is required");
      const user = await User.findById(req.user!._id);
      if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
        throw new ApiError(401, "Current password is incorrect");
      }
      await updateAdminPassword(String(user._id), input.newAdminPassword);
    }
    const settings = await updateSettings(input);
    await recordAuditLog({
      actor: req.user,
      action: "settings.updated",
      targetType: "settings",
      targetId: "default",
      metadata: {
        holmesApiUrl: Boolean(input.holmesApiUrl),
        holmesApiKeyChanged: Boolean(input.holmesApiKey || input.clearHolmesApiKey),
        defaultModel: input.defaultModel,
        timezone: input.timezone,
        passwordChanged: Boolean(input.newAdminPassword)
      }
    });
    res.json({ settings: toPublicSettings(settings) });
  })
);

router.post(
  "/test-holmes",
  asyncHandler(async (_req, res) => {
    const status = await new HolmesClient(await getHolmesConnection()).status();
    res.json({ status });
  })
);

export default router;
