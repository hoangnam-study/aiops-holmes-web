import { Schema, model } from "mongoose";

export interface SettingsDoc {
  key: "default";
  holmesApiUrl: string;
  holmesApiKeyEncrypted?: string | null;
  defaultModel: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsDoc>(
  {
    key: { type: String, enum: ["default"], required: true, unique: true },
    holmesApiUrl: { type: String, required: true },
    holmesApiKeyEncrypted: { type: String, default: null },
    defaultModel: { type: String, required: true },
    timezone: { type: String, required: true }
  },
  { timestamps: true }
);

export const Settings = model<SettingsDoc>("Settings", settingsSchema);
