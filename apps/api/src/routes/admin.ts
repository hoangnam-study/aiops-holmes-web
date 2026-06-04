import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { User, type UserDoc } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { type AuthRequest } from "../middleware/auth.js";
import { recordAuditLog } from "../services/auditService.js";

const router = Router();
const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");
const roleSchema = z.enum(["admin", "operator", "viewer"]);
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: roleSchema.default("viewer")
});
const updateUserSchema = z.object({
  role: roleSchema.optional(),
  password: z.string().min(8).optional()
});

function publicUser(user: UserDoc & { _id: unknown }) {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: 1 });
    res.json({ users: users.map((user) => publicUser(user as UserDoc & { _id: unknown })) });
  })
);

router.post(
  "/users",
  asyncHandler<AuthRequest>(async (req, res) => {
    const input = createUserSchema.parse(req.body);
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) throw new ApiError(409, "User already exists");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role
    });
    await recordAuditLog({
      actor: req.user,
      action: "user.created",
      targetType: "user",
      targetId: String(user._id),
      metadata: { email: user.email, role: user.role }
    });
    res.status(201).json({ user: publicUser(user as UserDoc & { _id: unknown }) });
  })
);

router.patch(
  "/users/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = updateUserSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (input.role) update.role = input.role;
    if (input.password) update.passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!user) throw new ApiError(404, "User not found");
    await recordAuditLog({
      actor: req.user,
      action: "user.updated",
      targetType: "user",
      targetId: String(user._id),
      metadata: { email: user.email, role: user.role, passwordChanged: Boolean(input.password) }
    });
    res.json({ user: publicUser(user as UserDoc & { _id: unknown }) });
  })
);

router.delete(
  "/users/:id",
  asyncHandler<AuthRequest>(async (req, res) => {
    const id = objectId.parse(req.params.id);
    if (String(req.user!._id) === id) throw new ApiError(400, "You cannot delete your own user");
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new ApiError(404, "User not found");
    await recordAuditLog({
      actor: req.user,
      action: "user.deleted",
      targetType: "user",
      targetId: String(user._id),
      metadata: { email: user.email, role: user.role }
    });
    res.json({ ok: true });
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (_req, res) => {
    const auditLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ auditLogs });
  })
);

export default router;
