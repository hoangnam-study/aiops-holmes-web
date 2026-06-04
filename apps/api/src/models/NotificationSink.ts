import { Schema, model, Types } from "mongoose";

export interface NotificationSinkDoc {
  name: string;
  type: "webhook" | "slackWebhook" | "teamsWebhook";
  enabled: boolean;
  urlEncrypted?: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSinkSchema = new Schema<NotificationSinkDoc>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["webhook", "slackWebhook", "teamsWebhook"], required: true },
    enabled: { type: Boolean, default: true, index: true },
    urlEncrypted: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

notificationSinkSchema.index({ name: "text" });

export const NotificationSink = model<NotificationSinkDoc>("NotificationSink", notificationSinkSchema);
