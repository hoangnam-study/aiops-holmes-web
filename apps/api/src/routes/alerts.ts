import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Alert } from "../models/Alert.js";
import { Incident } from "../models/Incident.js";
import { env } from "../config/env.js";
import { normalizeAlertmanagerPayload, type NormalizedAlert } from "../services/alertIngestService.js";
import { enqueueIncidentRca } from "../services/incidentRcaService.js";
import { asyncHandler, ApiError } from "../utils/errors.js";

export const alertWebhookRoutes = Router();
export const alertRoutes = Router();
export const incidentRoutes = Router();

const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid id");
const incidentPatchSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved"]).optional(),
  assignee: z.string().max(160).optional().nullable()
});
const alertPatchSchema = z.object({
  status: z.enum(["firing", "resolved"])
});

const severityRank: Record<string, number> = {
  critical: 3,
  warning: 2,
  info: 1,
  unknown: 0
};

function assertIngestToken(req: { headers: Record<string, unknown>; query: Record<string, unknown> }) {
  if (!env.ALERT_INGEST_TOKEN) return;
  const header = typeof req.headers["x-alert-ingest-token"] === "string" ? req.headers["x-alert-ingest-token"] : "";
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  if (![header, bearer, queryToken].includes(env.ALERT_INGEST_TOKEN)) {
    throw new ApiError(401, "Invalid alert ingest token");
  }
}

async function upsertNormalizedAlert(input: NormalizedAlert) {
  const now = new Date();
  let incident = await Incident.findOne({ key: input.incidentKey });

  if (!incident) {
    incident = await Incident.create({
      key: input.incidentKey,
      title: input.title,
      status: input.status === "resolved" ? "resolved" : "open",
      severity: input.severity,
      source: input.source,
      labels: input.labels,
      alertCount: 0,
      firstSeenAt: input.startsAt ?? now,
      lastSeenAt: input.endsAt ?? input.startsAt ?? now,
      resolvedAt: input.status === "resolved" ? input.endsAt ?? now : undefined
    });
  } else {
    incident.title = input.title || incident.title;
    incident.source = input.source || incident.source;
    const existingLabels =
      incident.labels instanceof Map ? Object.fromEntries(incident.labels) : (incident.labels ?? {});
    incident.labels = { ...existingLabels, ...input.labels };
    incident.lastSeenAt = input.endsAt ?? input.startsAt ?? now;
    if ((severityRank[input.severity] ?? 0) > (severityRank[incident.severity] ?? 0)) incident.severity = input.severity;
    if (input.status === "firing" && incident.status === "resolved") {
      incident.status = "open";
      incident.resolvedAt = undefined;
    }
  }

  const existingAlert = await Alert.findOne({ fingerprint: input.fingerprint });
  if (existingAlert) {
    existingAlert.incidentId = incident._id;
    existingAlert.status = input.status;
    existingAlert.severity = input.severity;
    existingAlert.source = input.source;
    existingAlert.title = input.title;
    existingAlert.description = input.description;
    existingAlert.labels = input.labels;
    existingAlert.annotations = input.annotations;
    existingAlert.startsAt = input.startsAt;
    existingAlert.endsAt = input.endsAt;
    existingAlert.generatorURL = input.generatorURL;
    existingAlert.rawPayload = input.rawPayload;
    await existingAlert.save();
  } else {
    await Alert.create({
      incidentId: incident._id,
      fingerprint: input.fingerprint,
      status: input.status,
      severity: input.severity,
      source: input.source,
      title: input.title,
      description: input.description,
      labels: input.labels,
      annotations: input.annotations,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      generatorURL: input.generatorURL,
      rawPayload: input.rawPayload
    });
  }

  const [alertCount, activeCount] = await Promise.all([
    Alert.countDocuments({ incidentId: incident._id }),
    Alert.countDocuments({ incidentId: incident._id, status: "firing" })
  ]);
  incident.alertCount = alertCount;
  if (activeCount === 0) {
    incident.status = "resolved";
    incident.resolvedAt = incident.resolvedAt ?? input.endsAt ?? now;
  } else if (incident.status === "resolved") {
    incident.status = "open";
    incident.resolvedAt = undefined;
  }
  await incident.save();
  return incident;
}

alertWebhookRoutes.post(
  "/alertmanager",
  asyncHandler(async (req, res) => {
    assertIngestToken(req);
    const normalized = normalizeAlertmanagerPayload(req.body);
    const incidents = [];
    for (const alert of normalized) {
      incidents.push(await upsertNormalizedAlert(alert));
    }
    const incidentIds = [...new Set(incidents.map((incident) => String(incident._id)))];
    for (const incidentId of incidentIds) {
      if (normalized.some((alert) => alert.status === "firing")) {
        void enqueueIncidentRca(incidentId).catch(() => undefined);
      }
    }
    res.status(202).json({
      ok: true,
      accepted: normalized.length,
      incidentIds
    });
  })
);

alertRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.status === "string") filter.status = req.query.status;
    if (typeof req.query.severity === "string") filter.severity = req.query.severity;
    if (typeof req.query.incidentId === "string" && Types.ObjectId.isValid(req.query.incidentId)) {
      filter.incidentId = req.query.incidentId;
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) filter.$text = { $search: req.query.search.trim() };

    const alerts = await Alert.find(filter).sort({ startsAt: -1, updatedAt: -1 }).limit(200).lean();
    res.json({ alerts });
  })
);

alertRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const alert = await Alert.findById(id).lean();
    if (!alert) throw new ApiError(404, "Alert not found");
    res.json({ alert });
  })
);

alertRoutes.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = alertPatchSchema.parse(req.body);
    const alert = await Alert.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!alert) throw new ApiError(404, "Alert not found");
    const activeCount = await Alert.countDocuments({ incidentId: alert.incidentId, status: "firing" });
    if (activeCount === 0) {
      await Incident.findByIdAndUpdate(alert.incidentId, { $set: { status: "resolved", resolvedAt: new Date() } });
    }
    res.json({ alert });
  })
);

incidentRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.status === "string") filter.status = req.query.status;
    if (typeof req.query.severity === "string") filter.severity = req.query.severity;
    if (typeof req.query.search === "string" && req.query.search.trim()) filter.$text = { $search: req.query.search.trim() };

    const incidents = await Incident.find(filter).sort({ lastSeenAt: -1, updatedAt: -1 }).limit(120).lean();
    res.json({ incidents });
  })
);

incidentRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const incident = await Incident.findById(id).lean();
    if (!incident) throw new ApiError(404, "Incident not found");
    const alerts = await Alert.find({ incidentId: id }).sort({ startsAt: -1, updatedAt: -1 }).lean();
    res.json({ incident, alerts });
  })
);

incidentRoutes.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const input = incidentPatchSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (input.status) {
      update.status = input.status;
      update.resolvedAt = input.status === "resolved" ? new Date() : null;
    }
    if (input.assignee !== undefined) update.assignee = input.assignee || null;
    const incident = await Incident.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!incident) throw new ApiError(404, "Incident not found");
    res.json({ incident });
  })
);

incidentRoutes.post(
  "/:id/rca/run",
  asyncHandler(async (req, res) => {
    const id = objectId.parse(req.params.id);
    const incident = await Incident.findById(id);
    if (!incident) throw new ApiError(404, "Incident not found");
    await enqueueIncidentRca(String(incident._id));
    res.status(202).json({ incident });
  })
);
