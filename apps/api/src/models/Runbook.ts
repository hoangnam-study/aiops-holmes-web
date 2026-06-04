import { Schema, model, Types } from "mongoose";

export interface RunbookDoc {
  title: string;
  description?: string;
  content: string;
  source: "manual" | "git" | "uploaded";
  sourceRef?: string;
  matchers: string[];
  tags: string[];
  enabled: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const runbookSchema = new Schema<RunbookDoc>(
  {
    title: { type: String, required: true },
    description: { type: String },
    content: { type: String, required: true },
    source: { type: String, enum: ["manual", "git", "uploaded"], default: "manual" },
    sourceRef: { type: String },
    matchers: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    enabled: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

runbookSchema.index({ title: "text", description: "text", content: "text", tags: "text", matchers: "text" });

export const Runbook = model<RunbookDoc>("Runbook", runbookSchema);
