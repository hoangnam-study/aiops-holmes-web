import { Schema, model, Types } from "mongoose";

export interface ChatEventDoc {
  threadId: Types.ObjectId;
  messageId?: Types.ObjectId;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const chatEventSchema = new Schema<ChatEventDoc>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "ChatThread", required: true, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

chatEventSchema.index({ threadId: 1, createdAt: 1 });

export const ChatEvent = model<ChatEventDoc>("ChatEvent", chatEventSchema);
