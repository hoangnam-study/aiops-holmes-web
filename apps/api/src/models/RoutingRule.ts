import { Schema, model, Types } from "mongoose";

export interface RoutingRuleDoc {
  name: string;
  enabled: boolean;
  eventType: "alert_ingested" | "rca_completed" | "rca_failed" | "incident_status_changed";
  sinkId: Types.ObjectId;
  severity?: "critical" | "warning" | "info" | "unknown" | "any";
  status?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const routingRuleSchema = new Schema<RoutingRuleDoc>(
  {
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true, index: true },
    eventType: {
      type: String,
      enum: ["alert_ingested", "rca_completed", "rca_failed", "incident_status_changed"],
      required: true,
      index: true
    },
    sinkId: { type: Schema.Types.ObjectId, ref: "NotificationSink", required: true, index: true },
    severity: { type: String, enum: ["critical", "warning", "info", "unknown", "any"], default: "any" },
    status: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

routingRuleSchema.index({ enabled: 1, eventType: 1 });

export const RoutingRule = model<RoutingRuleDoc>("RoutingRule", routingRuleSchema);
