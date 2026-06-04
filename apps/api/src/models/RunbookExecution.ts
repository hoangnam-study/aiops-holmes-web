import { Schema, model, Types } from "mongoose";

export interface RunbookExecutionDoc {
  runbookId: Types.ObjectId;
  status: "running" | "success" | "error";
  incidentId?: Types.ObjectId;
  scope?: string;
  startedAt: Date;
  completedAt?: Date;
  report?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const runbookExecutionSchema = new Schema<RunbookExecutionDoc>(
  {
    runbookId: { type: Schema.Types.ObjectId, ref: "Runbook", required: true, index: true },
    status: { type: String, enum: ["running", "success", "error"], default: "running" },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident" },
    scope: { type: String },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    report: { type: String },
    error: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

runbookExecutionSchema.index({ runbookId: 1, startedAt: -1 });

export const RunbookExecution = model<RunbookExecutionDoc>("RunbookExecution", runbookExecutionSchema);
