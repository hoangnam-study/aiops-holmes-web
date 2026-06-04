import { Schema, model, Types } from "mongoose";

export interface ScheduledPromptDoc {
  title: string;
  prompt: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  model?: string;
  destination: {
    type: "none" | "slackWebhook";
    webhookUrlEncrypted?: string | null;
  };
  lastRunAt?: Date;
  lastStatus?: "success" | "error" | "running";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledPromptSchema = new Schema<ScheduledPromptDoc>(
  {
    title: { type: String, required: true },
    prompt: { type: String, required: true },
    cron: { type: String, required: true },
    timezone: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    model: { type: String },
    destination: {
      type: {
        type: String,
        enum: ["none", "slackWebhook"],
        default: "none"
      },
      webhookUrlEncrypted: { type: String, default: null }
    },
    lastRunAt: { type: Date },
    lastStatus: { type: String, enum: ["success", "error", "running"] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

scheduledPromptSchema.index({ enabled: 1, updatedAt: -1 });

export const ScheduledPrompt = model<ScheduledPromptDoc>("ScheduledPrompt", scheduledPromptSchema);
