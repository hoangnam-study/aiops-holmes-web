import { Schema, model, Types } from "mongoose";

export interface AgentDoc {
  clusterId: Types.ObjectId;
  agentId: string;
  version?: string;
  status: "healthy" | "degraded" | "offline";
  metadata: Record<string, unknown>;
  lastHeartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const agentSchema = new Schema<AgentDoc>(
  {
    clusterId: { type: Schema.Types.ObjectId, ref: "Cluster", required: true, index: true },
    agentId: { type: String, required: true },
    version: { type: String },
    status: { type: String, enum: ["healthy", "degraded", "offline"], default: "healthy", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    lastHeartbeatAt: { type: Date, required: true }
  },
  { timestamps: true }
);

agentSchema.index({ clusterId: 1, agentId: 1 }, { unique: true });
agentSchema.index({ lastHeartbeatAt: -1 });

export const Agent = model<AgentDoc>("Agent", agentSchema);
