import { Types } from "mongoose";
import { IncidentEvent } from "../models/IncidentEvent.js";

export async function recordIncidentEvent(input: {
  incidentId: Types.ObjectId | string;
  eventType: "alert_ingested" | "status_changed" | "rca_queued" | "rca_started" | "rca_completed" | "rca_failed" | "comment";
  title: string;
  detail?: string;
  payload?: Record<string, unknown>;
  createdBy?: Types.ObjectId | string;
}) {
  return IncidentEvent.create({
    incidentId: input.incidentId,
    eventType: input.eventType,
    title: input.title,
    detail: input.detail,
    payload: input.payload ?? {},
    createdBy: input.createdBy
  });
}
