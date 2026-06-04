import { Schema, model, Types } from "mongoose";

export interface HealthCheckRunDoc {
  healthCheckId: Types.ObjectId;
  status: "running" | "success" | "error";
  startedAt: Date;
  completedAt?: Date;
  answer?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const healthCheckRunSchema = new Schema<HealthCheckRunDoc>(
  {
    healthCheckId: { type: Schema.Types.ObjectId, ref: "HealthCheck", required: true, index: true },
    status: { type: String, enum: ["running", "success", "error"], default: "running" },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    answer: { type: String },
    error: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

healthCheckRunSchema.index({ healthCheckId: 1, startedAt: -1 });

export const HealthCheckRun = model<HealthCheckRunDoc>("HealthCheckRun", healthCheckRunSchema);
