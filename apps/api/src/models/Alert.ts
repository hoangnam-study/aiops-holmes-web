import { Schema, model, Types } from "mongoose";

export interface AlertDoc {
  incidentId: Types.ObjectId;
  fingerprint: string;
  status: "firing" | "resolved";
  severity: "critical" | "warning" | "info" | "unknown";
  source: string;
  title: string;
  description: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt?: Date;
  endsAt?: Date;
  generatorURL?: string;
  rawPayload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<AlertDoc>(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true, index: true },
    fingerprint: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["firing", "resolved"], default: "firing", index: true },
    severity: { type: String, enum: ["critical", "warning", "info", "unknown"], default: "unknown", index: true },
    source: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    labels: { type: Map, of: String, default: {} },
    annotations: { type: Map, of: String, default: {} },
    startsAt: { type: Date },
    endsAt: { type: Date },
    generatorURL: { type: String },
    rawPayload: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

alertSchema.index({ title: "text", description: "text" });
alertSchema.index({ incidentId: 1, updatedAt: -1 });

export const Alert = model<AlertDoc>("Alert", alertSchema);
