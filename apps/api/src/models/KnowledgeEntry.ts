import { Schema, model, Types } from "mongoose";

export interface KnowledgeEntryDoc {
  title: string;
  content: string;
  scope: "global" | "personal" | "agent";
  type: "instruction" | "skill";
  enabled: boolean;
  tags: string[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeEntrySchema = new Schema<KnowledgeEntryDoc>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    scope: { type: String, enum: ["global", "personal", "agent"], default: "global" },
    type: { type: String, enum: ["instruction", "skill"], default: "instruction" },
    enabled: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

knowledgeEntrySchema.index({ title: "text", content: "text", tags: "text" });

export const KnowledgeEntry = model<KnowledgeEntryDoc>("KnowledgeEntry", knowledgeEntrySchema);
