import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert as MuiAlert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import MarkdownMessage from "../components/MarkdownMessage";
import { apiFetch, patchJson, postJson } from "../api/client";
import type { Alert, Incident } from "../types/api";

dayjs.extend(relativeTime);

interface IncidentDetail {
  incident: Incident;
  alerts: Alert[];
}

const statuses = ["open", "acknowledged", "resolved"] as const;
const severities = ["critical", "warning", "info", "unknown"] as const;

function labelsOf(labels: Record<string, string>, keys: string[]) {
  return keys.map((key) => labels[key]).filter(Boolean).join(" / ");
}

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");

  const incidentsQuery = useQuery({
    queryKey: ["incidents", status, severity, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (severity) params.set("severity", severity);
      if (search.trim()) params.set("search", search.trim());
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return apiFetch<{ incidents: Incident[] }>(`/api/incidents${suffix}`);
    }
  });

  const selectedIncidentId = selectedId ?? incidentsQuery.data?.incidents[0]?._id ?? "";
  const detailQuery = useQuery({
    queryKey: ["incident", selectedIncidentId],
    queryFn: () => apiFetch<IncidentDetail>(`/api/incidents/${selectedIncidentId}`),
    enabled: Boolean(selectedIncidentId)
  });

  const patchIncident = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: Incident["status"] }) =>
      patchJson<{ incident: Incident }>(`/api/incidents/${id}`, { status: nextStatus }),
    onSuccess: (_payload, variables) => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident", variables.id] });
    }
  });

  const runRca = useMutation({
    mutationFn: (id: string) => postJson<{ incident: Incident }>(`/api/incidents/${id}/rca/run`),
    onSuccess: (_payload, id) => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident", id] });
    }
  });

  const incidents = incidentsQuery.data?.incidents ?? [];
  const detail = detailQuery.data;

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Incidents"
        subtitle="Alert triage, grouping, status, severity, and investigation context."
        actions={
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search incidents"
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
            />
            <TextField size="small" select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="">All</MenuItem>
              {statuses.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
            <TextField size="small" select label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="">All</MenuItem>
              {severities.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
          </Stack>
        }
      />

      <Box sx={{ p: 3, flex: 1, minHeight: 0 }}>
        <Paper elevation={0} sx={{ height: "100%", display: "grid", gridTemplateColumns: "390px minmax(0, 1fr)", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ borderRight: "1px solid", borderColor: "divider", minHeight: 0, overflowY: "auto" }}>
            <Stack sx={{ p: 2 }} spacing={0.25}>
              <Typography variant="h6">{incidents.length} Incidents</Typography>
              <Typography variant="body2" color="text.secondary">
                Grouped by alert name, cluster, namespace, and workload.
              </Typography>
            </Stack>
            <Divider />
            {incidentsQuery.isLoading ? (
              <Box sx={{ p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <List dense disablePadding>
                {incidents.map((incident) => (
                  <ListItemButton
                    key={incident._id}
                    selected={incident._id === selectedIncidentId}
                    onClick={() => setSelectedId(incident._id)}
                    sx={{ alignItems: "flex-start", px: 2, py: 1.5 }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Typography fontWeight={800} noWrap sx={{ flex: 1 }}>
                            {incident.title}
                          </Typography>
                          <StatusPill value={incident.severity} />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {labelsOf(incident.labels, ["cluster", "namespace", "service", "deployment", "pod"]) || incident.source}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <StatusPill value={incident.status} />
                            <Chip size="small" label={`${incident.alertCount} alerts`} />
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(incident.lastSeenAt).fromNow()}
                            </Typography>
                          </Stack>
                        </Stack>
                      }
                    />
                  </ListItemButton>
                ))}
                {!incidents.length ? (
                  <Box sx={{ p: 3 }}>
                    <Typography fontWeight={800}>No incidents found</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Alertmanager webhooks will appear here after ingestion.
                    </Typography>
                  </Box>
                ) : null}
              </List>
            )}
          </Box>

          <Box sx={{ p: 3, minHeight: 0, overflowY: "auto" }}>
            {!detailQuery.isLoading && !detail ? (
              <Typography color="text.secondary">Select an incident to inspect its alerts.</Typography>
            ) : null}
            {detailQuery.isLoading ? <CircularProgress size={24} /> : null}
            {detail ? (
              <Stack spacing={2.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h4">{detail.incident.title}</Typography>
                      <StatusPill value={detail.incident.severity} />
                      <StatusPill value={detail.incident.status} />
                      <StatusPill value={detail.incident.rcaStatus} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {detail.incident.key}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      First seen {dayjs(detail.incident.firstSeenAt).format("YYYY-MM-DD HH:mm")} · Last seen {dayjs(detail.incident.lastSeenAt).fromNow()}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant={detail.incident.status === "acknowledged" ? "contained" : "outlined"}
                      onClick={() => patchIncident.mutate({ id: detail.incident._id, nextStatus: "acknowledged" })}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      variant={detail.incident.status === "resolved" ? "contained" : "outlined"}
                      color="success"
                      onClick={() => patchIncident.mutate({ id: detail.incident._id, nextStatus: "resolved" })}
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="contained"
                      disabled={runRca.isPending || detail.incident.rcaStatus === "queued" || detail.incident.rcaStatus === "investigating"}
                      onClick={() => runRca.mutate(detail.incident._id)}
                    >
                      Run RCA
                    </Button>
                  </Stack>
                </Stack>

                <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="h6">Automatic RCA</Typography>
                    <StatusPill value={detail.incident.rcaStatus} />
                  </Stack>
                  {detail.incident.rcaSummary ? (
                    <MarkdownMessage content={detail.incident.rcaSummary} />
                  ) : detail.incident.rcaError ? (
                    <MuiAlert severity="error">{detail.incident.rcaError}</MuiAlert>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Holmes will investigate automatically when firing alerts are ingested.
                    </Typography>
                  )}
                </Paper>

                <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="h6" gutterBottom>
                    Labels
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {Object.entries(detail.incident.labels ?? {}).map(([key, value]) => (
                      <Chip key={key} size="small" label={`${key}=${value}`} />
                    ))}
                  </Stack>
                </Paper>

                <Stack spacing={1.5}>
                  <Typography variant="h5">Alerts</Typography>
                  {detail.alerts.map((alert) => (
                    <Paper key={alert._id} elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontWeight={800}>{alert.title}</Typography>
                            <StatusPill value={alert.status} />
                          </Stack>
                          {alert.description ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                              {alert.description}
                            </Typography>
                          ) : null}
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                            {alert.startsAt ? dayjs(alert.startsAt).format("YYYY-MM-DD HH:mm") : "No start time"} · {alert.fingerprint}
                          </Typography>
                        </Box>
                        {alert.generatorURL ? (
                          <Button size="small" href={alert.generatorURL} target="_blank" rel="noreferrer">
                            Source
                          </Button>
                        ) : null}
                      </Stack>
                    </Paper>
                  ))}
                  {!detail.alerts.length ? <MuiAlert severity="info">This incident has no alerts yet.</MuiAlert> : null}
                </Stack>
              </Stack>
            ) : null}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
