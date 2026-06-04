import { Schema, model, Types } from "mongoose";

export type ChangeKind =
  | "deploy"
  | "config_change"
  | "scale"
  | "rollback"
  | "image_change"
  | "feature_flag"
  | "other";

export interface ChangeEventDoc {
  kind: ChangeKind;
  title: string;
  description?: string;
  cluster?: string;
  namespace?: string;
  workload?: string;
  service?: string;
  labels: Record<string, string>;
  author?: string;
  source: string;
  version?: string;
  previousVersion?: string;
  link?: string;
  occurredAt: Date;
  incidentIds: Types.ObjectId[];
  rawPayload: Record<string, unknown>;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const changeKinds: ChangeKind[] = [
  "deploy",
  "config_change",
  "scale",
  "rollback",
  "image_change",
  "feature_flag",
  "other"
];

const changeEventSchema = new Schema<ChangeEventDoc>(
  {
    kind: { type: String, enum: changeKinds, default: "other", index: true },
    title: { type: String, required: true },
    description: { type: String },
    cluster: { type: String, index: true },
    namespace: { type: String, index: true },
    workload: { type: String, index: true },
    service: { type: String },
    labels: { type: Map, of: String, default: {} },
    author: { type: String },
    source: { type: String, required: true },
    version: { type: String },
    previousVersion: { type: String },
    link: { type: String },
    occurredAt: { type: Date, required: true, index: true },
    incidentIds: { type: [Schema.Types.ObjectId], ref: "Incident", default: [] },
    rawPayload: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

changeEventSchema.index({ title: "text", workload: "text", service: "text" });
changeEventSchema.index({ occurredAt: -1 });
changeEventSchema.index({ cluster: 1, namespace: 1, occurredAt: -1 });

export const ChangeEvent = model<ChangeEventDoc>("ChangeEvent", changeEventSchema);
