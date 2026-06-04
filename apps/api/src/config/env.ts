import { z } from "zod";

const booleanFromEnv = (defaultValue: "true" | "false") => z
  .string()
  .default(defaultValue)
  .transform((value) => !["0", "false", "no", "off"].includes(value.trim().toLowerCase()));

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/holmes-ui"),
  APP_SECRET: z.string().default("dev-change-me-dev-change-me-dev-change-me"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8).default("holmes-admin"),
  HOLMES_API_URL: z.string().url().default("https://holmes.observestack.fis-cloud.xplat.online"),
  HOLMES_API_KEY: z.string().optional(),
  HOLMES_API_VERIFY_SSL: booleanFromEnv("false"),
  HOLMES_STREAM_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  ALERT_INGEST_TOKEN: z.string().optional(),
  DEFAULT_MODEL: z.string().default("cloud-escalate"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Ho_Chi_Minh"),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
