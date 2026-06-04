import { Chip } from "@mui/material";

const colors: Record<string, "success" | "warning" | "error" | "default" | "info"> = {
  connected: "success",
  configured: "info",
  unknown: "default",
  failed: "error",
  success: "success",
  error: "error",
  running: "warning",
  active: "success",
  open: "error",
  acknowledged: "warning",
  resolved: "success",
  firing: "error",
  critical: "error",
  warning: "warning",
  info: "info",
  not_started: "default",
  queued: "info",
  investigating: "warning",
  completed: "success"
};

export default function StatusPill({ value }: { value?: string }) {
  const label = value ?? "unknown";
  return <Chip size="small" label={label} color={colors[label] ?? "default"} sx={{ fontWeight: 700 }} />;
}
