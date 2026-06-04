import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorMiddleware } from "./utils/errors.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import holmesRoutes from "./routes/holmes.js";
import chatRoutes from "./routes/chats.js";
import dataSourceRoutes from "./routes/dataSources.js";
import knowledgeRoutes from "./routes/knowledge.js";
import scheduledPromptRoutes from "./routes/scheduledPrompts.js";
import settingsRoutes from "./routes/settings.js";
import { alertRoutes, alertWebhookRoutes, incidentRoutes } from "./routes/alerts.js";
import botRoutes from "./routes/bots.js";
import notificationRoutes from "./routes/notifications.js";
import adminRoutes from "./routes/admin.js";
import { agentRoutes, clusterRoutes } from "./routes/clusters.js";
import healthCheckRoutes from "./routes/healthChecks.js";
import runbookRoutes from "./routes/runbooks.js";
import { changeRoutes, changeWebhookRoutes } from "./routes/changes.js";
import feedbackRoutes from "./routes/feedback.js";
import analyticsRoutes from "./routes/analytics.js";

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/alerts/webhooks", alertWebhookRoutes);
  app.use("/api/changes/webhooks", changeWebhookRoutes);
  app.use("/api/bots", botRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/holmes", requireAuth, holmesRoutes);
  app.use("/api/chats", requireAuth, chatRoutes);
  app.use("/api/alerts", requireAuth, alertRoutes);
  app.use("/api/incidents", requireAuth, incidentRoutes);
  app.use("/api/changes", requireAuth, changeRoutes);
  app.use("/api/feedback", requireAuth, feedbackRoutes);
  app.use("/api/analytics", requireAuth, analyticsRoutes);
  app.use("/api/notifications", requireAuth, requireRole("admin", "operator"), notificationRoutes);
  app.use("/api/clusters", requireAuth, requireRole("admin", "operator"), clusterRoutes);
  app.use("/api/health-checks", requireAuth, requireRole("admin", "operator"), healthCheckRoutes);
  app.use("/api/runbooks", requireAuth, requireRole("admin", "operator"), runbookRoutes);
  app.use("/api/admin", requireAuth, requireRole("admin"), adminRoutes);
  app.use("/api/data-sources", requireAuth, requireRole("admin", "operator"), dataSourceRoutes);
  app.use("/api/knowledge", requireAuth, requireRole("admin", "operator"), knowledgeRoutes);
  app.use("/api/scheduled-prompts", requireAuth, requireRole("admin", "operator"), scheduledPromptRoutes);
  app.use("/api/settings", requireAuth, requireRole("admin"), settingsRoutes);

  app.use(errorMiddleware);
  return app;
}
