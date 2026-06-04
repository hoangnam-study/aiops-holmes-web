import { Schema, model, Types } from "mongoose";

export interface ChatMessageDoc {
  threadId: Types.ObjectId;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status: "pending" | "streaming" | "completed" | "awaiting_approval" | "error";
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<ChatMessageDoc>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "ChatThread", required: true, index: true },
    role: { type: String, enum: ["user", "assistant", "system", "tool"], required: true },
    content: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "streaming", "completed", "awaiting_approval", "error"],
      default: "pending"
    },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

chatMessageSchema.index({ threadId: 1, createdAt: 1 });

export const ChatMessage = model<ChatMessageDoc>("ChatMessage", chatMessageSchema);
