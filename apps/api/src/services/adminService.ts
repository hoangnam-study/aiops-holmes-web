import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

export async function ensureAdminUser() {
  const existing = await User.findOne({ role: "admin" });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  return User.create({
    email: env.ADMIN_EMAIL,
    passwordHash,
    role: "admin"
  });
}

export async function updateAdminPassword(userId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await User.findByIdAndUpdate(userId, { passwordHash });
}
