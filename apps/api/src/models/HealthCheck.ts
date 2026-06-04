import { Schema, model, Types } from "mongoose";

export interface HealthCheckDoc {
  title: string;
  prompt: string;
  scope?: string;
  labels: string[];
  enabled: boolean;
  alertMode: "none" | "notify_on_failure" | "always_notify";
  lastRunAt?: Date;
  lastStatus?: "success" | "error" | "running";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const healthCheckSchema = new Schema<HealthCheckDoc>(
  {
    title: { type: String, required: true },
    prompt: { type: String, required: true },
    scope: { type: String },
    labels: { type: [String], default: [] },
    enabled: { type: Boolean, default: true, index: true },
    alertMode: { type: String, enum: ["none", "notify_on_failure", "always_notify"], default: "none" },
    lastRunAt: { type: Date },
    lastStatus: { type: String, enum: ["success", "error", "running"] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

healthCheckSchema.index({ title: "text", prompt: "text", labels: "text" });

export const HealthCheck = model<HealthCheckDoc>("HealthCheck", healthCheckSchema);
