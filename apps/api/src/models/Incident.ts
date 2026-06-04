import { Schema, model, Types } from "mongoose";

export interface IncidentDoc {
  key: string;
  title: string;
  status: "open" | "acknowledged" | "resolved";
  severity: "critical" | "warning" | "info" | "unknown";
  source: string;
  labels: Record<string, string>;
  alertCount: number;
  rcaStatus: "not_started" | "queued" | "investigating" | "completed" | "failed";
  rcaSummary?: string;
  rcaError?: string;
  rcaStartedAt?: Date;
  rcaCompletedAt?: Date;
  assignee?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IncidentDoc>(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    status: { type: String, enum: ["open", "acknowledged", "resolved"], default: "open", index: true },
    severity: { type: String, enum: ["critical", "warning", "info", "unknown"], default: "unknown", index: true },
    source: { type: String, required: true },
    labels: { type: Map, of: String, default: {} },
    alertCount: { type: Number, default: 0 },
    rcaStatus: {
      type: String,
      enum: ["not_started", "queued", "investigating", "completed", "failed"],
      default: "not_started",
      index: true
    },
    rcaSummary: { type: String },
    rcaError: { type: String },
    rcaStartedAt: { type: Date },
    rcaCompletedAt: { type: Date },
    assignee: { type: String },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    resolvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

incidentSchema.index({ title: "text", assignee: "text" });
incidentSchema.index({ status: 1, lastSeenAt: -1 });

export const Incident = model<IncidentDoc>("Incident", incidentSchema);
