import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Divider,
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
import dayjs from "dayjs";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { apiFetch, deleteJson, postJson } from "../api/client";
import type { NotificationDelivery, NotificationSink, RoutingRule } from "../types/api";

const sinkTypes = ["webhook", "slackWebhook", "teamsWebhook"] as const;
const eventTypes = ["alert_ingested", "rca_completed", "rca_failed", "incident_status_changed"] as const;
const severities = ["any", "critical", "warning", "info", "unknown"] as const;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [sinkForm, setSinkForm] = useState({ name: "", type: "slackWebhook", url: "", enabled: true });
  const [ruleForm, setRuleForm] = useState({ name: "", eventType: "rca_completed", sinkId: "", severity: "any", status: "", enabled: true });
  const [error, setError] = useState("");

  const sinksQuery = useQuery({
    queryKey: ["notification-sinks"],
    queryFn: () => apiFetch<{ sinks: NotificationSink[] }>("/api/notifications/sinks")
  });
  const rulesQuery = useQuery({
    queryKey: ["routing-rules"],
    queryFn: () => apiFetch<{ rules: RoutingRule[] }>("/api/notifications/rules")
  });
  const deliveriesQuery = useQuery({
    queryKey: ["notification-deliveries"],
    queryFn: () => apiFetch<{ deliveries: NotificationDelivery[] }>("/api/notifications/deliveries"),
    refetchInterval: 30_000
  });

  const createSink = useMutation({
    mutationFn: () => postJson<{ sink: NotificationSink }>("/api/notifications/sinks", sinkForm),
    onSuccess: () => {
      setSinkForm({ name: "", type: "slackWebhook", url: "", enabled: true });
      setError("");
      queryClient.invalidateQueries({ queryKey: ["notification-sinks"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Unable to create sink")
  });

  const createRule = useMutation({
    mutationFn: () =>
      postJson<{ rule: RoutingRule }>("/api/notifications/rules", {
        ...ruleForm,
        status: ruleForm.status || undefined
      }),
    onSuccess: () => {
      setRuleForm({ name: "", eventType: "rca_completed", sinkId: "", severity: "any", status: "", enabled: true });
      setError("");
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Unable to create routing rule")
  });

  const deleteSink = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/notifications/sinks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-sinks"] });
      queryClient.invalidateQueries({ queryKey: ["routing-rules"] });
    }
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/notifications/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routing-rules"] })
  });

  const sinks = sinksQuery.data?.sinks ?? [];
  const rules = rulesQuery.data?.rules ?? [];
  const sinkName = (id: string) => sinks.find((sink) => sink._id === id)?.name ?? id;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Notifications" subtitle="Reusable sinks, routing rules, and delivery history for incident events." />
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 430px", gap: 2 }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Sinks</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField label="Name" value={sinkForm.name} onChange={(event) => setSinkForm({ ...sinkForm, name: event.target.value })} fullWidth />
              <TextField label="Type" select value={sinkForm.type} onChange={(event) => setSinkForm({ ...sinkForm, type: event.target.value })} fullWidth>
                {sinkTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </TextField>
              <TextField label="Webhook URL" value={sinkForm.url} onChange={(event) => setSinkForm({ ...sinkForm, url: event.target.value })} fullWidth />
              <FormControlLabel control={<Switch checked={sinkForm.enabled} onChange={(event) => setSinkForm({ ...sinkForm, enabled: event.target.checked })} />} label="Enabled" />
              <Button variant="contained" startIcon={<AddIcon />} disabled={!sinkForm.name || !sinkForm.url || createSink.isPending} onClick={() => createSink.mutate()}>
                Sink
              </Button>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {sinks.map((sink) => (
                  <TableRow key={sink._id}>
                    <TableCell>{sink.name}</TableCell>
                    <TableCell>{sink.type}</TableCell>
                    <TableCell><StatusPill value={sink.enabled ? "active" : "unknown"} /></TableCell>
                    <TableCell>{sink.hasUrl ? "stored" : "missing"}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => deleteSink.mutate(sink._id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Routing Rules</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField label="Name" value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} fullWidth />
              <TextField label="Event" select value={ruleForm.eventType} onChange={(event) => setRuleForm({ ...ruleForm, eventType: event.target.value })} fullWidth>
                {eventTypes.map((eventType) => <MenuItem key={eventType} value={eventType}>{eventType}</MenuItem>)}
              </TextField>
              <TextField label="Sink" select value={ruleForm.sinkId} onChange={(event) => setRuleForm({ ...ruleForm, sinkId: event.target.value })} fullWidth>
                {sinks.map((sink) => <MenuItem key={sink._id} value={sink._id}>{sink.name}</MenuItem>)}
              </TextField>
              <TextField label="Severity" select value={ruleForm.severity} onChange={(event) => setRuleForm({ ...ruleForm, severity: event.target.value })} fullWidth>
                {severities.map((severity) => <MenuItem key={severity} value={severity}>{severity}</MenuItem>)}
              </TextField>
              <Button variant="contained" startIcon={<AddIcon />} disabled={!ruleForm.name || !ruleForm.sinkId || createRule.isPending} onClick={() => createRule.mutate()}>
                Rule
              </Button>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Sink</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule._id}>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{rule.eventType}</TableCell>
                    <TableCell>{sinkName(rule.sinkId)}</TableCell>
                    <TableCell><StatusPill value={rule.severity} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => deleteRule.mutate(rule._id)}>
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
          <Typography variant="h5" gutterBottom>Delivery History</Typography>
          <Divider sx={{ mb: 1.5 }} />
          <Stack spacing={1.25}>
            {(deliveriesQuery.data?.deliveries ?? []).map((delivery) => (
              <Paper key={delivery._id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={800}>{delivery.eventType}</Typography>
                  <StatusPill value={delivery.status} />
                </Stack>
                <Typography variant="body2" color="text.secondary">{delivery.target}</Typography>
                <Typography variant="caption" color="text.secondary">{dayjs(delivery.createdAt).format("YYYY-MM-DD HH:mm:ss")}</Typography>
                {delivery.error ? <Alert severity="error" sx={{ mt: 1 }}>{delivery.error}</Alert> : null}
              </Paper>
            ))}
            {!deliveriesQuery.data?.deliveries.length ? (
              <Typography variant="body2" color="text.secondary">No deliveries yet.</Typography>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
