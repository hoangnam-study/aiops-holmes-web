import { Schema, model } from "mongoose";

export interface DataSourceDoc {
  key: string;
  title: string;
  category:
    | "Kubernetes"
    | "Metrics"
    | "Logs"
    | "Traces"
    | "Profiles"
    | "Dashboards"
    | "Cloud"
    | "ITSM"
    | "SCM"
    | "Database"
    | "Queue"
    | "CI/CD"
    | "Custom"
    | "Future";
  description: string;
  status: "connected" | "configured" | "unknown" | "failed";
  enabled: boolean;
  toolsetKey?: string;
  capabilities: string[];
  docsUrl?: string;
  configSchema?: Record<string, unknown>;
  secretFields: string[];
  verifyPrompt: string;
  setupMarkdown: string;
  lastVerifiedAt?: Date;
  verificationMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dataSourceSchema = new Schema<DataSourceDoc>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["connected", "configured", "unknown", "failed"], default: "unknown" },
    enabled: { type: Boolean, default: true, index: true },
    toolsetKey: { type: String },
    capabilities: { type: [String], default: [] },
    docsUrl: { type: String },
    configSchema: { type: Schema.Types.Mixed },
    secretFields: { type: [String], default: [] },
    verifyPrompt: { type: String, required: true },
    setupMarkdown: { type: String, required: true },
    lastVerifiedAt: { type: Date },
    verificationMessage: { type: String }
  },
  { timestamps: true }
);

export const DataSource = model<DataSourceDoc>("DataSource", dataSourceSchema);
