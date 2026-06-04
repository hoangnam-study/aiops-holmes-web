import { Schema, model, Types } from "mongoose";

export interface FeedbackDoc {
  targetType: "incident_rca" | "chat_message";
  targetId: string;
  rating: "up" | "down";
  note?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<FeedbackDoc>(
  {
    targetType: { type: String, enum: ["incident_rca", "chat_message"], required: true, index: true },
    targetId: { type: String, required: true, index: true },
    rating: { type: String, enum: ["up", "down"], required: true },
    note: { type: String, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// One feedback row per (target, author): re-submitting updates the existing rating.
feedbackSchema.index({ targetType: 1, targetId: 1, createdBy: 1 }, { unique: true, sparse: true });
feedbackSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const Feedback = model<FeedbackDoc>("Feedback", feedbackSchema);
