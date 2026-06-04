import { Schema, model, Types } from "mongoose";

export interface NotificationDeliveryDoc {
  sinkId: Types.ObjectId;
  routingRuleId?: Types.ObjectId;
  eventType: string;
  status: "success" | "error";
  target: string;
  requestPayload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationDeliverySchema = new Schema<NotificationDeliveryDoc>(
  {
    sinkId: { type: Schema.Types.ObjectId, ref: "NotificationSink", required: true, index: true },
    routingRuleId: { type: Schema.Types.ObjectId, ref: "RoutingRule" },
    eventType: { type: String, required: true, index: true },
    status: { type: String, enum: ["success", "error"], required: true, index: true },
    target: { type: String, required: true },
    requestPayload: { type: Schema.Types.Mixed, default: {} },
    responseStatus: { type: Number },
    responseBody: { type: String },
    error: { type: String }
  },
  { timestamps: true }
);

notificationDeliverySchema.index({ createdAt: -1 });

export const NotificationDelivery = model<NotificationDeliveryDoc>("NotificationDelivery", notificationDeliverySchema);
