import { AuditLog } from "../models/AuditLog.js";
import type { UserDoc } from "../models/User.js";

export async function recordAuditLog(input: {
  actor?: (UserDoc & { _id: unknown }) | null;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  return AuditLog.create({
    actorId: input.actor?._id,
    actorEmail: input.actor?.email,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {}
  });
}
