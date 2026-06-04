import { useState } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert as MuiAlert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PageHeader from "../components/PageHeader";
import { apiFetch, postJson } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { ChangeEvent, ChangeKind } from "../types/api";

dayjs.extend(relativeTime);

const kinds: ChangeKind[] = [
  "deploy",
  "config_change",
  "scale",
  "rollback",
  "image_change",
  "feature_flag",
  "other"
];

const kindColor: Record<ChangeKind, "primary" | "warning" | "error" | "info" | "default" | "secondary"> = {
  deploy: "primary",
  image_change: "info",
  config_change: "secondary",
  scale: "default",
  rollback: "error",
  feature_flag: "warning",
  other: "default"
};

interface FormState {
  kind: ChangeKind;
  title: string;
  cluster: string;
  namespace: string;
  workload: string;
  version: string;
  previousVersion: string;
  author: string;
  source: string;
  link: string;
  description: string;
}

const emptyForm: FormState = {
  kind: "deploy",
  title: "",
  cluster: "",
  namespace: "",
  workload: "",
  version: "",
  previousVersion: "",
  author: "",
  source: "manual",
  link: "",
  description: ""
};

export default function ChangesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "operator";
  const [kind, setKind] = useState("");
  const [namespace, setNamespace] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const changesQuery = useQuery({
    queryKey: ["changes", kind, namespace, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (namespace.trim()) params.set("namespace", namespace.trim());
      if (search.trim()) params.set("search", search.trim());
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return apiFetch<{ changes: ChangeEvent[] }>(`/api/changes${suffix}`);
    }
  });

  const createChange = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { kind: form.kind, title: form.title, source: form.source || "manual" };
      for (const key of ["cluster", "namespace", "workload", "version", "previousVersion", "author", "link", "description"] as const) {
        if (form[key].trim()) payload[key] = form[key].trim();
      }
      return postJson<{ change: ChangeEvent; correlatedIncidentIds: string[] }>("/api/changes", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changes"] });
      setDialogOpen(false);
      setForm(emptyForm);
    }
  });

  const changes = changesQuery.data?.changes ?? [];
  const setField = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Changes"
        subtitle="Deploys, config changes, scaling, and rollbacks correlated to incidents."
        actions={
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search changes"
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
            />
            <TextField
              size="small"
              value={namespace}
              onChange={(event) => setNamespace(event.target.value)}
              placeholder="Namespace"
              sx={{ width: 150 }}
            />
            <TextField size="small" select label="Kind" value={kind} onChange={(event) => setKind(event.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="">All</MenuItem>
              {kinds.map((item) => (
                <MenuItem key={item} value={item}>{item.replace(/_/g, " ")}</MenuItem>
              ))}
            </TextField>
            {canEdit ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                Record change
              </Button>
            ) : null}
          </Stack>
        }
      />

      <Box sx={{ p: 3, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
          <Stack sx={{ p: 2 }} spacing={0.25}>
            <Typography variant="h6">{changes.length} Changes</Typography>
            <Typography variant="body2" color="text.secondary">
              Ingest via <code>POST /api/changes/webhooks/event</code> (ArgoCD, Flux, GitHub, Kubernetes) or record manually.
            </Typography>
          </Stack>
          <Divider />
          {changesQuery.isLoading ? (
            <Box sx={{ p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List disablePadding>
              {changes.map((change) => (
                <ListItem key={change._id} divider alignItems="flex-start" sx={{ py: 1.5 }}>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }} useFlexGap flexWrap="wrap">
                        <Chip size="small" label={change.kind.replace(/_/g, " ")} color={kindColor[change.kind]} sx={{ fontWeight: 700 }} />
                        <Typography fontWeight={800}>{change.title}</Typography>
                        {change.version ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={change.previousVersion ? `${change.previousVersion} → ${change.version}` : change.version}
                          />
                        ) : null}
                        {change.incidentIds.length ? (
                          <Chip size="small" color="error" variant="outlined" label={`${change.incidentIds.length} incident${change.incidentIds.length > 1 ? "s" : ""}`} />
                        ) : null}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          {[change.cluster, change.namespace, change.workload].filter(Boolean).join(" / ") || "no scope"}
                          {change.author ? ` · by ${change.author}` : ""} · {change.source}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(change.occurredAt).format("YYYY-MM-DD HH:mm")} ({dayjs(change.occurredAt).fromNow()})
                        </Typography>
                        {change.description ? (
                          <Typography variant="body2" color="text.secondary">{change.description}</Typography>
                        ) : null}
                      </Stack>
                    }
                  />
                  {change.link ? (
                    <Button size="small" href={change.link} target="_blank" rel="noreferrer">
                      Source
                    </Button>
                  ) : null}
                </ListItem>
              ))}
              {!changes.length ? (
                <Box sx={{ p: 3 }}>
                  <Typography fontWeight={800}>No changes recorded</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Send deploy/config events to the change webhook, or record one manually.
                  </Typography>
                </Box>
              ) : null}
            </List>
          )}
        </Paper>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record change</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createChange.isError ? (
              <MuiAlert severity="error">{(createChange.error as Error).message}</MuiAlert>
            ) : null}
            <TextField select label="Kind" value={form.kind} onChange={setField("kind")} fullWidth>
              {kinds.map((item) => (
                <MenuItem key={item} value={item}>{item.replace(/_/g, " ")}</MenuItem>
              ))}
            </TextField>
            <TextField label="Title" value={form.title} onChange={setField("title")} fullWidth required />
            <Stack direction="row" spacing={2}>
              <TextField label="Cluster" value={form.cluster} onChange={setField("cluster")} fullWidth />
              <TextField label="Namespace" value={form.namespace} onChange={setField("namespace")} fullWidth />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Workload" value={form.workload} onChange={setField("workload")} fullWidth />
              <TextField label="Source" value={form.source} onChange={setField("source")} fullWidth />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Previous version" value={form.previousVersion} onChange={setField("previousVersion")} fullWidth />
              <TextField label="New version" value={form.version} onChange={setField("version")} fullWidth />
            </Stack>
            <TextField label="Author" value={form.author} onChange={setField("author")} fullWidth />
            <TextField label="Link" value={form.link} onChange={setField("link")} fullWidth placeholder="https://..." />
            <TextField label="Description" value={form.description} onChange={setField("description")} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.title.trim() || createChange.isPending}
            onClick={() => createChange.mutate()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
