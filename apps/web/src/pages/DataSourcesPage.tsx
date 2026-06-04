import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import MarkdownMessage from "../components/MarkdownMessage";
import { apiFetch, deleteJson, patchJson, postJson } from "../api/client";
import type { DataSource } from "../types/api";

const categories = ["Kubernetes", "Metrics", "Logs", "Traces", "Profiles", "Dashboards", "Cloud", "ITSM", "SCM", "Database", "Queue", "CI/CD", "Custom", "Future"];
const emptyForm = {
  key: "",
  title: "",
  category: "Custom",
  description: "",
  enabled: true,
  toolsetKey: "",
  docsUrl: "",
  verifyPrompt: "",
  setupMarkdown: "### Helm values\n\n```yaml\nholmesgpt:\n  toolsets:\n    custom:\n      enabled: true\n```"
};

export default function DataSourcesPage() {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DataSource | null>(null);
  const [form, setForm] = useState(emptyForm);

  const dataSourcesQuery = useQuery({
    queryKey: ["data-sources"],
    queryFn: () => apiFetch<{ dataSources: DataSource[] }>("/api/data-sources")
  });

  const selected = dataSourcesQuery.data?.dataSources.find(
    (source) => source.key === (selectedKey ?? dataSourcesQuery.data?.dataSources[0]?.key)
  );

  const setupQuery = useQuery({
    queryKey: ["data-source-setup", selected?.key],
    queryFn: () => apiFetch<{ setupMarkdown: string }>(`/api/data-sources/${selected!.key}/setup`),
    enabled: Boolean(selected)
  });

  const verifyMutation = useMutation({
    mutationFn: (key: string) => postJson(`/api/data-sources/${key}/verify`),
    onSuccess: () => {
      setVerifyError("");
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
    },
    onError: (error) => {
      setVerifyError(error instanceof Error ? error.message : "Verification failed");
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
    }
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        status: editing?.status ?? "unknown",
        capabilities: [],
        secretFields: [],
        docsUrl: form.docsUrl || undefined,
        toolsetKey: form.toolsetKey || undefined
      };
      if (editing) return patchJson<{ dataSource: DataSource }>(`/api/data-sources/${editing.key}`, payload);
      return postJson<{ dataSource: DataSource }>("/api/data-sources", payload);
    },
    onSuccess: (payload) => {
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setSelectedKey(payload.dataSource.key);
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteJson(`/api/data-sources/${key}`),
    onSuccess: () => {
      setSelectedKey(null);
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
    }
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (source: DataSource) => {
    setEditing(source);
    setForm({
      key: source.key,
      title: source.title,
      category: source.category,
      description: source.description,
      enabled: source.enabled,
      toolsetKey: source.toolsetKey ?? "",
      docsUrl: source.docsUrl ?? "",
      verifyPrompt: source.verifyPrompt,
      setupMarkdown: ""
    });
    void apiFetch<{ setupMarkdown: string }>(`/api/data-sources/${source.key}/setup`).then((payload) => {
      setForm((current) => ({ ...current, setupMarkdown: payload.setupMarkdown }));
    });
    setDialogOpen(true);
  };

  const grouped = (dataSourcesQuery.data?.dataSources ?? []).reduce<Record<string, DataSource[]>>((acc, source) => {
    acc[source.category] = [...(acc[source.category] ?? []), source];
    return acc;
  }, {});

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Data Sources"
        subtitle="Connected Holmes toolsets and setup guidance for future integrations."
        actions={
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={openCreate}>
            Add source
          </Button>
        }
      />
      <Box sx={{ p: 3, flex: 1, minHeight: 0 }}>
        <Paper elevation={0} sx={{ height: "100%", display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ borderRight: "1px solid", borderColor: "divider", overflowY: "auto" }}>
            <Stack sx={{ p: 2 }} spacing={0.25}>
              <Typography variant="h6">{dataSourcesQuery.data?.dataSources.length ?? 0} Data Sources</Typography>
              <Typography variant="body2" color="text.secondary">
                Verify integrations through Holmes before relying on them in chat.
              </Typography>
            </Stack>
            <Divider />
            {dataSourcesQuery.isLoading ? (
              <Box sx={{ p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <List dense>
                {Object.entries(grouped).map(([category, sources]) => (
                  <Box key={category}>
                    <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ px: 2, py: 1, display: "block" }}>
                      {category}
                    </Typography>
                    {sources.map((source) => (
                      <ListItemButton
                        key={source.key}
                        selected={source.key === selected?.key}
                        onClick={() => setSelectedKey(source.key)}
                        sx={{ px: 2, py: 1.2 }}
                      >
                        <ListItemText
                          primary={source.title}
                          secondary={source.description}
                          primaryTypographyProps={{ fontWeight: 800 }}
                          secondaryTypographyProps={{ noWrap: true }}
                        />
                        <StatusPill value={source.status} />
                        {!source.enabled ? <StatusPill value="disabled" /> : null}
                      </ListItemButton>
                    ))}
                  </Box>
                ))}
              </List>
            )}
          </Box>

          <Box sx={{ p: 4, overflowY: "auto" }}>
            {selected ? (
              <Stack spacing={3} sx={{ maxWidth: 900 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h4">{selected.title}</Typography>
                    <Typography variant="h4" color={selected.status === "connected" ? "success.main" : "text.secondary"}>
                      {selected.status === "connected" ? "is Connected" : "is Not Verified"}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {selected.description}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StatusPill value={selected.status} />
                    <StatusPill value={selected.enabled ? "active" : "disabled"} />
                    {selected.toolsetKey ? <Typography variant="caption">{selected.toolsetKey}</Typography> : null}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<EditIcon />} onClick={() => openEdit(selected)}>
                      Edit
                    </Button>
                    <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => deleteMutation.mutate(selected.key)}>
                      Delete
                    </Button>
                  </Stack>
                </Stack>

                {verifyError ? <Alert severity="error">{verifyError}</Alert> : null}

                <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", maxWidth: 420 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <VerifiedOutlinedIcon color="primary" />
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={800}>Verify with Holmes</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Run an end-to-end check against this source.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      disabled={verifyMutation.isPending || !selected.enabled}
                      onClick={() => verifyMutation.mutate(selected.key)}
                    >
                      Verify
                    </Button>
                  </Stack>
                </Paper>

                {selected.verificationMessage ? (
                  <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                      Last verification
                    </Typography>
                    <MarkdownMessage content={selected.verificationMessage} />
                  </Paper>
                ) : null}

                <Box>
                  <Typography variant="h5" gutterBottom>
                    Setup Instructions
                  </Typography>
                  <MarkdownMessage content={setupQuery.data?.setupMarkdown ?? "Loading setup instructions..."} />
                  {selected.docsUrl ? (
                    <Button href={selected.docsUrl} target="_blank" rel="noreferrer" sx={{ mt: 2 }}>
                      Documentation
                    </Button>
                  ) : null}
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">No data source selected.</Typography>
            )}
          </Box>
        </Paper>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Edit Data Source" : "Add Data Source"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Key" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} disabled={Boolean(editing)} fullWidth />
              <TextField label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} fullWidth />
              <TextField label="Category" select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} fullWidth>
                {categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} fullWidth />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Toolset key" value={form.toolsetKey} onChange={(event) => setForm({ ...form, toolsetKey: event.target.value })} fullWidth />
              <TextField label="Docs URL" value={form.docsUrl} onChange={(event) => setForm({ ...form, docsUrl: event.target.value })} fullWidth />
            </Stack>
            <TextField label="Verification prompt" value={form.verifyPrompt} onChange={(event) => setForm({ ...form, verifyPrompt: event.target.value })} multiline minRows={3} fullWidth />
            <TextField label="Setup markdown" value={form.setupMarkdown} onChange={(event) => setForm({ ...form, setupMarkdown: event.target.value })} multiline minRows={6} fullWidth />
            <FormControlLabel control={<Switch checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />} label="Enabled" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!form.key || !form.title || !form.description || !form.verifyPrompt || !form.setupMarkdown || saveMutation.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
