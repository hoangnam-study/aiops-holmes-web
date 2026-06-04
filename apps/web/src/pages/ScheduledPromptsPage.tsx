import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import MarkdownMessage from "../components/MarkdownMessage";
import { apiFetch, deleteJson, patchJson, postJson } from "../api/client";
import type { ScheduledPrompt, ScheduledPromptRun, Settings } from "../types/api";

dayjs.extend(relativeTime);

interface FormState {
  title: string;
  prompt: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  model: string;
  destinationType: "none" | "slackWebhook";
  webhookUrl: string;
}

const emptyForm: FormState = {
  title: "",
  prompt: "",
  cron: "0 10 * * 1",
  timezone: "Asia/Ho_Chi_Minh",
  enabled: true,
  model: "",
  destinationType: "none",
  webhookUrl: ""
};

export default function ScheduledPromptsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ScheduledPrompt | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [selectedRunPrompt, setSelectedRunPrompt] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<{ settings: Settings }>("/api/settings")
  });

  const promptsQuery = useQuery({
    queryKey: ["scheduled-prompts"],
    queryFn: () => apiFetch<{ scheduledPrompts: ScheduledPrompt[] }>("/api/scheduled-prompts")
  });

  const runsQuery = useQuery({
    queryKey: ["scheduled-prompt-runs", selectedRunPrompt],
    queryFn: () => apiFetch<{ runs: ScheduledPromptRun[] }>(`/api/scheduled-prompts/${selectedRunPrompt}/runs`),
    enabled: Boolean(selectedRunPrompt)
  });

  useEffect(() => {
    setForm((current) => ({ ...current, timezone: settingsQuery.data?.settings.timezone ?? current.timezone, model: settingsQuery.data?.settings.defaultModel ?? current.model }));
  }, [settingsQuery.data?.settings.defaultModel, settingsQuery.data?.settings.timezone]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        prompt: form.prompt,
        cron: form.cron,
        timezone: form.timezone,
        enabled: form.enabled,
        model: form.model || undefined,
        destination: {
          type: form.destinationType,
          webhookUrl: form.destinationType === "slackWebhook" ? form.webhookUrl : null
        }
      };
      if (editing) return patchJson(`/api/scheduled-prompts/${editing._id}`, payload);
      return postJson("/api/scheduled-prompts", payload);
    },
    onSuccess: () => {
      setEditing(null);
      setDialogOpen(false);
      setForm(emptyForm);
      setError("");
      queryClient.invalidateQueries({ queryKey: ["scheduled-prompts"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Unable to save scheduled prompt")
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => postJson<{ run: ScheduledPromptRun }>(`/api/scheduled-prompts/${id}/run`),
    onSuccess: (_payload, id) => {
      setSelectedRunPrompt(id);
      queryClient.invalidateQueries({ queryKey: ["scheduled-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-prompt-runs", id] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/scheduled-prompts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-prompts"] })
  });

  const openCreate = () => {
    setEditing(null);
    setError("");
    setDialogOpen(true);
    setForm({
      ...emptyForm,
      timezone: settingsQuery.data?.settings.timezone ?? "Asia/Ho_Chi_Minh",
      model: settingsQuery.data?.settings.defaultModel ?? "cloud-escalate"
    });
  };

  const openEdit = (prompt: ScheduledPrompt) => {
    setEditing(prompt);
    setError("");
    setDialogOpen(true);
    setForm({
      title: prompt.title,
      prompt: prompt.prompt,
      cron: prompt.cron,
      timezone: prompt.timezone,
      enabled: prompt.enabled,
      model: prompt.model || settingsQuery.data?.settings.defaultModel || "cloud-escalate",
      destinationType: prompt.destination.type,
      webhookUrl: ""
    });
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Scheduled Prompts"
        subtitle="Run Holmes prompts on cron and store each investigation result."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Scheduled Prompt
          </Button>
        }
      />
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 2, minHeight: 0 }}>
        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography fontWeight={800}>
              Showing {promptsQuery.data?.scheduledPrompts.length ?? 0} Scheduled Prompts
            </Typography>
          </Stack>
          <Divider />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell>Model</TableCell>
                <TableCell>Last run</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(promptsQuery.data?.scheduledPrompts ?? []).map((prompt) => (
                <TableRow key={prompt._id} hover selected={prompt._id === selectedRunPrompt}>
                  <TableCell>
                    <Button color="inherit" onClick={() => openEdit(prompt)} sx={{ fontWeight: 800 }}>
                      {prompt.title}
                    </Button>
                  </TableCell>
                  <TableCell>{prompt.cron}</TableCell>
                  <TableCell>{prompt.model || settingsQuery.data?.settings.defaultModel}</TableCell>
                  <TableCell>{prompt.lastRunAt ? dayjs(prompt.lastRunAt).fromNow() : "Never"}</TableCell>
                  <TableCell>
                    <StatusPill value={prompt.lastStatus ?? (prompt.enabled ? "active" : "unknown")} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Run now">
                      <IconButton size="small" onClick={() => runMutation.mutate(prompt._id)}>
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="History">
                      <IconButton size="small" onClick={() => setSelectedRunPrompt(prompt._id)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => deleteMutation.mutate(prompt._id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", p: 2, overflowY: "auto", maxHeight: "calc(100vh - 132px)" }}>
          <Typography variant="h5" gutterBottom>
            Run History
          </Typography>
          {!selectedRunPrompt ? (
            <Typography variant="body2" color="text.secondary">
              Select a prompt to inspect recent executions.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {(runsQuery.data?.runs ?? []).map((run) => (
                <Paper key={run._id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(run.startedAt).format("YYYY-MM-DD HH:mm")}
                    </Typography>
                    <StatusPill value={run.status} />
                  </Stack>
                  {run.answer ? <MarkdownMessage content={run.answer} /> : null}
                  {run.error ? <Alert severity="error" sx={{ mt: 1 }}>{run.error}</Alert> : null}
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); setForm(emptyForm); }} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Edit Scheduled Prompt" : "New Scheduled Prompt"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} fullWidth />
            <TextField
              label="Prompt"
              value={form.prompt}
              onChange={(event) => setForm({ ...form, prompt: event.target.value })}
              multiline
              minRows={5}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Cron" value={form.cron} onChange={(event) => setForm({ ...form, cron: event.target.value })} fullWidth />
              <TextField label="Timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} fullWidth />
              <TextField label="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Destination"
                select
                value={form.destinationType}
                onChange={(event) => setForm({ ...form, destinationType: event.target.value as "none" | "slackWebhook" })}
                fullWidth
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="slackWebhook">Slack webhook</MenuItem>
              </TextField>
              {form.destinationType === "slackWebhook" ? (
                <TextField
                  label={editing?.destination.hasWebhook ? "New webhook URL" : "Webhook URL"}
                  value={form.webhookUrl}
                  onChange={(event) => setForm({ ...form, webhookUrl: event.target.value })}
                  fullWidth
                />
              ) : null}
            </Stack>
            <FormControlLabel
              control={<Switch checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />}
              label="Enabled"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setEditing(null); setForm(emptyForm); }}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
