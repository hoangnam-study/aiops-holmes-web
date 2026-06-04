import { nanoid } from "nanoid";
import { JobLock } from "../models/JobLock.js";

export async function withJobLock<T>(key: string, ttlMs: number, fn: () => Promise<T>) {
  const owner = nanoid();
  await JobLock.deleteMany({ key, expiresAt: { $lte: new Date() } });
  try {
    await JobLock.create({ key, owner, expiresAt: new Date(Date.now() + ttlMs) });
  } catch {
    return null;
  }

  try {
    return await fn();
  } finally {
    await JobLock.deleteOne({ key, owner });
  }
}
