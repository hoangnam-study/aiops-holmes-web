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
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import dayjs from "dayjs";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import MarkdownMessage from "../components/MarkdownMessage";
import { apiFetch, deleteJson, postJson } from "../api/client";
import type { Runbook, RunbookExecution } from "../types/api";

export default function RunbooksPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", content: "", source: "manual", sourceRef: "", matchers: "", tags: "", enabled: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState("");

  const runbooksQuery = useQuery({
    queryKey: ["runbooks"],
    queryFn: () => apiFetch<{ runbooks: Runbook[] }>("/api/runbooks")
  });
  const selectedRunbookId = selectedId ?? runbooksQuery.data?.runbooks[0]?._id ?? "";
  const executionsQuery = useQuery({
    queryKey: ["runbook-executions", selectedRunbookId],
    queryFn: () => apiFetch<{ executions: RunbookExecution[] }>(`/api/runbooks/${selectedRunbookId}/executions`),
    enabled: Boolean(selectedRunbookId)
  });

  const createRunbook = useMutation({
    mutationFn: () => postJson<{ runbook: Runbook }>("/api/runbooks", {
      ...form,
      sourceRef: form.sourceRef || undefined,
      matchers: form.matchers.split(",").map((item) => item.trim()).filter(Boolean),
      tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean)
    }),
    onSuccess: (payload) => {
      setForm({ title: "", description: "", content: "", source: "manual", sourceRef: "", matchers: "", tags: "", enabled: true });
      setSelectedId(payload.runbook._id);
      queryClient.invalidateQueries({ queryKey: ["runbooks"] });
    }
  });

  const executeRunbook = useMutation({
    mutationFn: (id: string) => postJson<{ execution: RunbookExecution }>(`/api/runbooks/${id}/execute`, { scope: scope || undefined }),
    onSuccess: (_payload, id) => {
      setSelectedId(id);
      queryClient.invalidateQueries({ queryKey: ["runbook-executions", id] });
    }
  });

  const deleteRunbook = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/runbooks/${id}`),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["runbooks"] });
    }
  });

  const runbooks = runbooksQuery.data?.runbooks ?? [];
  const selected = runbooks.find((runbook) => runbook._id === selectedRunbookId);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Runbooks" subtitle="Reusable runbook catalog with guided Holmes execution." />
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 460px", gap: 2 }}>
        <Stack spacing={2}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Add Runbook</Typography>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} fullWidth />
                <TextField label="Source" select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} fullWidth>
                  <MenuItem value="manual">manual</MenuItem>
                  <MenuItem value="git">git</MenuItem>
                  <MenuItem value="uploaded">uploaded</MenuItem>
                </TextField>
                <TextField label="Source ref" value={form.sourceRef} onChange={(event) => setForm({ ...form, sourceRef: event.target.value })} fullWidth />
              </Stack>
              <TextField label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} fullWidth />
              <TextField label="Content" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} multiline minRows={8} fullWidth />
              <Stack direction="row" spacing={1.5} alignItems="center">
                <TextField label="Matchers" value={form.matchers} onChange={(event) => setForm({ ...form, matchers: event.target.value })} fullWidth />
                <TextField label="Tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} fullWidth />
                <FormControlLabel control={<Switch checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />} label="Enabled" />
                <Button variant="contained" startIcon={<AddIcon />} disabled={!form.title || !form.content || createRunbook.isPending} onClick={() => createRunbook.mutate()}>
                  Runbook
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Stack spacing={1.5}>
            {runbooks.map((runbook) => (
              <Paper key={runbook._id} elevation={0} onClick={() => setSelectedId(runbook._id)} sx={{ p: 2, border: "1px solid", borderColor: runbook._id === selectedRunbookId ? "primary.main" : "divider", cursor: "pointer" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6">{runbook.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{runbook.description || runbook.source}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <StatusPill value={runbook.enabled ? "active" : "disabled"} />
                    <IconButton size="small" onClick={(event) => { event.stopPropagation(); deleteRunbook.mutate(runbook._id); }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>

        <Stack spacing={2}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Execute</Typography>
            {selected ? (
              <Stack spacing={1.5}>
                <Typography fontWeight={800}>{selected.title}</Typography>
                <TextField label="Scope" value={scope} onChange={(event) => setScope(event.target.value)} fullWidth />
                <Button variant="contained" startIcon={<PlayArrowIcon />} disabled={executeRunbook.isPending || !selected.enabled} onClick={() => executeRunbook.mutate(selected._id)}>
                  Execute runbook
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">Select a runbook to execute.</Typography>
            )}
          </Paper>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Execution History</Typography>
            <Stack spacing={1.5}>
              {(executionsQuery.data?.executions ?? []).map((execution) => (
                <Paper key={execution._id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">{dayjs(execution.startedAt).format("YYYY-MM-DD HH:mm")}</Typography>
                    <StatusPill value={execution.status} />
                  </Stack>
                  {execution.report ? <MarkdownMessage content={execution.report} /> : null}
                  {execution.error ? <Alert severity="error" sx={{ mt: 1 }}>{execution.error}</Alert> : null}
                </Paper>
              ))}
              {!executionsQuery.data?.executions.length ? (
                <Typography variant="body2" color="text.secondary">No executions yet.</Typography>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}
