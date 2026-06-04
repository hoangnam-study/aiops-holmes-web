import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tabs,
  Tab,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import PageHeader from "../components/PageHeader";
import MarkdownMessage from "../components/MarkdownMessage";
import { apiFetch, deleteJson, patchJson, postJson } from "../api/client";
import type { KnowledgeEntry } from "../types/api";

type Scope = "global" | "personal" | "agent";
type EntryType = "instruction" | "skill";

const scopes: { value: Scope; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "global", label: "Global" },
  { value: "agent", label: "Per-Agent" }
];

const emptyForm = {
  title: "",
  content: "",
  scope: "global" as Scope,
  type: "instruction" as EntryType,
  enabled: true,
  tags: ""
};

export default function KnowledgePage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>("global");
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const knowledgeQuery = useQuery({
    queryKey: ["knowledge", scope],
    queryFn: () => apiFetch<{ entries: KnowledgeEntry[] }>(`/api/knowledge?scope=${scope}`)
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        content: form.content,
        scope: form.scope,
        type: form.type,
        enabled: form.enabled,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      };
      if (editing) return patchJson(`/api/knowledge/${editing._id}`, payload);
      return postJson("/api/knowledge", payload);
    },
    onSuccess: () => {
      setEditing(null);
      setDialogOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/knowledge/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] })
  });

  const toggleMutation = useMutation({
    mutationFn: (entry: KnowledgeEntry) => patchJson(`/api/knowledge/${entry._id}`, { enabled: !entry.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] })
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
    setForm({ ...emptyForm, scope });
  };

  const openEdit = (entry: KnowledgeEntry) => {
    setEditing(entry);
    setDialogOpen(true);
    setForm({
      title: entry.title,
      content: entry.content,
      scope: entry.scope,
      type: entry.type,
      enabled: entry.enabled,
      tags: entry.tags.join(", ")
    });
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Knowledge"
        subtitle="Instructions and reusable skills injected into Holmes conversations."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add Knowledge
          </Button>
        }
      />
      <Box sx={{ px: 3, pt: 2 }}>
        <Tabs value={scope} onChange={(_event, value) => setScope(value)}>
          {scopes.map((item) => (
            <Tab key={item.value} value={item.value} label={item.label} />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 2 }}>
        {(knowledgeQuery.data?.entries ?? []).map((entry) => (
          <Paper key={entry._id} elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", minHeight: 220 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap>
                  {entry.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={800}>
                  {entry.type} · {entry.scope}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Switch size="small" checked={entry.enabled} onChange={() => toggleMutation.mutate(entry)} />
                <IconButton size="small" onClick={() => openEdit(entry)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => deleteMutation.mutate(entry._id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
            <Box sx={{ mt: 1.5, flex: 1, overflow: "hidden" }}>
              <MarkdownMessage content={entry.content.length > 900 ? `${entry.content.slice(0, 900)}...` : entry.content} />
            </Box>
          </Paper>
        ))}
        {!knowledgeQuery.data?.entries.length ? (
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography fontWeight={800}>No entries yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Capture recurring environment details, service naming rules, or proven investigation steps.
            </Typography>
          </Paper>
        ) : null}
      </Box>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); setForm(emptyForm); }} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Edit Knowledge" : "Add Knowledge"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} fullWidth />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Scope"
                select
                value={form.scope}
                onChange={(event) => setForm({ ...form, scope: event.target.value as Scope })}
                fullWidth
              >
                {scopes.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Type"
                select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as EntryType })}
                fullWidth
              >
                <MenuItem value="instruction">Instruction</MenuItem>
                <MenuItem value="skill">Skill</MenuItem>
              </TextField>
            </Stack>
            <TextField
              label="Content"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              multiline
              minRows={8}
              fullWidth
            />
            <TextField label="Tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} fullWidth />
            <FormControlLabel
              control={<Switch checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />}
              label="Enabled"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setEditing(null); setForm(emptyForm); }}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!form.title || !form.content}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
