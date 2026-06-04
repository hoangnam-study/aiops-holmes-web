import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import MarkdownMessage from "../components/MarkdownMessage";
import { apiFetch, deleteJson, postJson } from "../api/client";
import type { HealthCheck, HealthCheckRun } from "../types/api";

dayjs.extend(relativeTime);

export default function HealthChecksPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", prompt: "", scope: "", labels: "", enabled: true, alertMode: "none" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const checksQuery = useQuery({
    queryKey: ["health-checks"],
    queryFn: () => apiFetch<{ healthChecks: HealthCheck[] }>("/api/health-checks")
  });
  const selectedCheckId = selectedId ?? checksQuery.data?.healthChecks[0]?._id ?? "";
  const runsQuery = useQuery({
    queryKey: ["health-check-runs", selectedCheckId],
    queryFn: () => apiFetch<{ runs: HealthCheckRun[] }>(`/api/health-checks/${selectedCheckId}/runs`),
    enabled: Boolean(selectedCheckId)
  });

  const createCheck = useMutation({
    mutationFn: () => postJson<{ healthCheck: HealthCheck }>("/api/health-checks", {
      ...form,
      labels: form.labels.split(",").map((label) => label.trim()).filter(Boolean),
      scope: form.scope || undefined
    }),
    onSuccess: (payload) => {
      setForm({ title: "", prompt: "", scope: "", labels: "", enabled: true, alertMode: "none" });
      setSelectedId(payload.healthCheck._id);
      queryClient.invalidateQueries({ queryKey: ["health-checks"] });
    }
  });

  const runCheck = useMutation({
    mutationFn: (id: string) => postJson<{ run: HealthCheckRun }>(`/api/health-checks/${id}/run`),
    onSuccess: (_payload, id) => {
      setSelectedId(id);
      queryClient.invalidateQueries({ queryKey: ["health-checks"] });
      queryClient.invalidateQueries({ queryKey: ["health-check-runs", id] });
    }
  });

  const deleteCheck = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/health-checks/${id}`),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["health-checks"] });
    }
  });

  const checks = checksQuery.data?.healthChecks ?? [];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Health Checks" subtitle="One-time Holmes checks with run history and alerting intent." />
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 430px", gap: 2 }}>
        <Stack spacing={2}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>New Health Check</Typography>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} fullWidth />
                <TextField label="Scope" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} fullWidth />
                <TextField label="Alert mode" select value={form.alertMode} onChange={(event) => setForm({ ...form, alertMode: event.target.value })} fullWidth>
                  <MenuItem value="none">none</MenuItem>
                  <MenuItem value="notify_on_failure">notify_on_failure</MenuItem>
                  <MenuItem value="always_notify">always_notify</MenuItem>
                </TextField>
              </Stack>
              <TextField label="Prompt" value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} multiline minRows={4} fullWidth />
              <Stack direction="row" spacing={1.5} alignItems="center">
                <TextField label="Labels" value={form.labels} onChange={(event) => setForm({ ...form, labels: event.target.value })} fullWidth />
                <FormControlLabel control={<Switch checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />} label="Enabled" />
                <Button variant="contained" startIcon={<AddIcon />} disabled={!form.title || !form.prompt || createCheck.isPending} onClick={() => createCheck.mutate()}>
                  Check
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Checks</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Last run</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {checks.map((check) => (
                  <TableRow key={check._id} hover selected={check._id === selectedCheckId} onClick={() => setSelectedId(check._id)} sx={{ cursor: "pointer" }}>
                    <TableCell>{check.title}</TableCell>
                    <TableCell>{check.scope ?? "-"}</TableCell>
                    <TableCell>{check.lastRunAt ? dayjs(check.lastRunAt).fromNow() : "Never"}</TableCell>
                    <TableCell><StatusPill value={check.lastStatus ?? (check.enabled ? "active" : "disabled")} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(event) => { event.stopPropagation(); runCheck.mutate(check._id); }}>
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={(event) => { event.stopPropagation(); deleteCheck.mutate(check._id); }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>

        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", height: "fit-content" }}>
          <Typography variant="h5" gutterBottom>Run History</Typography>
          <Stack spacing={1.5}>
            {(runsQuery.data?.runs ?? []).map((run) => (
              <Paper key={run._id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">{dayjs(run.startedAt).format("YYYY-MM-DD HH:mm")}</Typography>
                  <StatusPill value={run.status} />
                </Stack>
                {run.answer ? <MarkdownMessage content={run.answer} /> : null}
                {run.error ? <Alert severity="error" sx={{ mt: 1 }}>{run.error}</Alert> : null}
              </Paper>
            ))}
            {!selectedCheckId ? <Typography variant="body2" color="text.secondary">Select a check to inspect run history.</Typography> : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
