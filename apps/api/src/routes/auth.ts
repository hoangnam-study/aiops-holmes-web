import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import {
  clearSessionCookie,
  createSessionToken,
  requireAuth,
  setSessionCookie,
  type AuthRequest
} from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password");
    }
    setSessionCookie(res, createSessionToken(user as never));
    res.json({ user: { id: String(user._id), email: user.email, role: user.role } });
  })
);

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    res.json({
      user: req.user
        ? { id: String(req.user._id), email: req.user.email, role: req.user.role }
        : null
    });
  })
);

export default router;
