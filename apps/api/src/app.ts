import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorMiddleware } from "./utils/errors.js";
import { requireAuth } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import holmesRoutes from "./routes/holmes.js";
import chatRoutes from "./routes/chats.js";
import dataSourceRoutes from "./routes/dataSources.js";
import knowledgeRoutes from "./routes/knowledge.js";
import scheduledPromptRoutes from "./routes/scheduledPrompts.js";
import settingsRoutes from "./routes/settings.js";
import { alertRoutes, alertWebhookRoutes, incidentRoutes } from "./routes/alerts.js";

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/alerts/webhooks", alertWebhookRoutes);
  app.use("/api/holmes", requireAuth, holmesRoutes);
  app.use("/api/chats", requireAuth, chatRoutes);
  app.use("/api/alerts", requireAuth, alertRoutes);
  app.use("/api/incidents", requireAuth, incidentRoutes);
  app.use("/api/data-sources", requireAuth, dataSourceRoutes);
  app.use("/api/knowledge", requireAuth, knowledgeRoutes);
  app.use("/api/scheduled-prompts", requireAuth, scheduledPromptRoutes);
  app.use("/api/settings", requireAuth, settingsRoutes);

  app.use(errorMiddleware);
  return app;
}
