import { Schema, model, Types } from "mongoose";

export interface IncidentEventDoc {
  incidentId: Types.ObjectId;
  eventType:
    | "alert_ingested"
    | "status_changed"
    | "rca_queued"
    | "rca_started"
    | "rca_completed"
    | "rca_failed"
    | "change_detected"
    | "comment";
  title: string;
  detail?: string;
  payload: Record<string, unknown>;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const incidentEventSchema = new Schema<IncidentEventDoc>(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true, index: true },
    eventType: {
      type: String,
      enum: ["alert_ingested", "status_changed", "rca_queued", "rca_started", "rca_completed", "rca_failed", "change_detected", "comment"],
      required: true,
      index: true
    },
    title: { type: String, required: true },
    detail: { type: String },
    payload: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

incidentEventSchema.index({ incidentId: 1, createdAt: -1 });

export const IncidentEvent = model<IncidentEventDoc>("IncidentEvent", incidentEventSchema);
