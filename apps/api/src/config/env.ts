import { z } from "zod";

const booleanFromEnv = (defaultValue: "true" | "false") => z
  .string()
  .default(defaultValue)
  .transform((value) => !["0", "false", "no", "off"].includes(value.trim().toLowerCase()));

const optionalString = () => z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
);

const optionalUrl = () => z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8765),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/holmes-ui"),
  APP_SECRET: z.string().default("dev-change-me-dev-change-me-dev-change-me"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8).default("holmes-admin"),
  HOLMES_API_URL: z.string().url().default("https://holmes.observestack.fis-cloud.xplat.online"),
  HOLMES_API_KEY: optionalString(),
  HOLMES_API_VERIFY_SSL: booleanFromEnv("false"),
  HOLMES_STREAM_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  ALERT_INGEST_TOKEN: optionalString(),
  CHANGE_INGEST_TOKEN: optionalString(),
  BOT_WEBHOOK_TOKEN: optionalString(),
  OIDC_ISSUER_URL: optionalUrl(),
  OIDC_CLIENT_ID: optionalString(),
  OIDC_CLIENT_SECRET: optionalString(),
  OIDC_REDIRECT_URI: optionalUrl(),
  OIDC_SCOPES: z.string().default("openid email profile"),
  OIDC_DEFAULT_ROLE: z.enum(["admin", "operator", "viewer"]).default("viewer"),
  DEFAULT_MODEL: z.string().default("cloud-escalate"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Ho_Chi_Minh"),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
