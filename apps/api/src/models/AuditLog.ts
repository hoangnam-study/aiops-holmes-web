import { Schema, model, Types } from "mongoose";

export interface AuditLogDoc {
  actorId?: Types.ObjectId;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorEmail: { type: String },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorEmail: "text", action: "text", targetType: "text" });

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);
