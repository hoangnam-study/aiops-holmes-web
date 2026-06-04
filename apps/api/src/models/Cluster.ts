import { Schema, model, Types } from "mongoose";

export interface ClusterDoc {
  name: string;
  slug: string;
  environment?: string;
  status: "unknown" | "healthy" | "degraded" | "offline";
  apiUrl?: string;
  enrollmentTokenEncrypted?: string | null;
  lastHeartbeatAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const clusterSchema = new Schema<ClusterDoc>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    environment: { type: String },
    status: { type: String, enum: ["unknown", "healthy", "degraded", "offline"], default: "unknown", index: true },
    apiUrl: { type: String },
    enrollmentTokenEncrypted: { type: String, default: null },
    lastHeartbeatAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

clusterSchema.index({ name: "text", slug: "text", environment: "text" });

export const Cluster = model<ClusterDoc>("Cluster", clusterSchema);
