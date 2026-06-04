import { Schema, model, Types } from "mongoose";

export interface ScheduledPromptRunDoc {
  scheduledPromptId: Types.ObjectId;
  status: "running" | "success" | "error";
  trigger: "scheduled" | "manual";
  startedAt: Date;
  completedAt?: Date;
  answer?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  toolEvents: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}

const scheduledPromptRunSchema = new Schema<ScheduledPromptRunDoc>(
  {
    scheduledPromptId: { type: Schema.Types.ObjectId, ref: "ScheduledPrompt", required: true, index: true },
    status: { type: String, enum: ["running", "success", "error"], default: "running" },
    trigger: { type: String, enum: ["scheduled", "manual"], required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    answer: { type: String },
    error: { type: String },
    metadata: { type: Schema.Types.Mixed },
    toolEvents: { type: [Schema.Types.Mixed], default: [] } as never
  },
  { timestamps: true }
);

scheduledPromptRunSchema.index({ scheduledPromptId: 1, startedAt: -1 });

export const ScheduledPromptRun = model<ScheduledPromptRunDoc>("ScheduledPromptRun", scheduledPromptRunSchema);
