import { env } from "../config/env.js";
import { Settings } from "../models/Settings.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";

export interface PublicSettings {
  holmesApiUrl: string;
  hasHolmesApiKey: boolean;
  defaultModel: string;
  timezone: string;
}

export async function ensureSettings() {
  const existing = await Settings.findOne({ key: "default" });
  if (existing) return existing;
  return Settings.create({
    key: "default",
    holmesApiUrl: env.HOLMES_API_URL,
    holmesApiKeyEncrypted: encryptSecret(env.HOLMES_API_KEY),
    defaultModel: env.DEFAULT_MODEL,
    timezone: env.DEFAULT_TIMEZONE
  });
}

export async function getSettings() {
  return ensureSettings();
}

export function toPublicSettings(settings: Awaited<ReturnType<typeof ensureSettings>>): PublicSettings {
  return {
    holmesApiUrl: settings.holmesApiUrl,
    hasHolmesApiKey: Boolean(settings.holmesApiKeyEncrypted),
    defaultModel: settings.defaultModel,
    timezone: settings.timezone
  };
}

export async function getHolmesConnection() {
  const settings = await ensureSettings();
  return {
    baseUrl: settings.holmesApiUrl,
    apiKey: decryptSecret(settings.holmesApiKeyEncrypted),
    defaultModel: settings.defaultModel,
    timezone: settings.timezone,
    verifySsl: env.HOLMES_API_VERIFY_SSL
  };
}

export async function updateSettings(input: {
  holmesApiUrl?: string;
  holmesApiKey?: string | null;
  clearHolmesApiKey?: boolean;
  defaultModel?: string;
  timezone?: string;
}) {
  const settings = await ensureSettings();
  if (input.holmesApiUrl !== undefined) settings.holmesApiUrl = input.holmesApiUrl;
  if (input.defaultModel !== undefined) settings.defaultModel = input.defaultModel;
  if (input.timezone !== undefined) settings.timezone = input.timezone;
  if (input.clearHolmesApiKey) settings.holmesApiKeyEncrypted = null;
  if (input.holmesApiKey) settings.holmesApiKeyEncrypted = encryptSecret(input.holmesApiKey);
  await settings.save();
  return settings;
}
