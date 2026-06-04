import { Schema, model, Types } from "mongoose";

export interface ChatThreadDoc {
  title: string;
  model?: string;
  visibility: "private" | "shared";
  archived: boolean;
  conversationHistory: Record<string, unknown>[];
  createdBy: Types.ObjectId;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatThreadSchema = new Schema<ChatThreadDoc>(
  {
    title: { type: String, required: true, default: "New chat" },
    model: { type: String },
    visibility: { type: String, enum: ["private", "shared"], default: "private" },
    archived: { type: Boolean, default: false },
    conversationHistory: { type: [Schema.Types.Mixed], default: [] } as never,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessageAt: { type: Date }
  },
  { timestamps: true }
);

chatThreadSchema.index({ createdBy: 1, updatedAt: -1 });
chatThreadSchema.index({ title: "text" });

export const ChatThread = model<ChatThreadDoc>("ChatThread", chatThreadSchema);
