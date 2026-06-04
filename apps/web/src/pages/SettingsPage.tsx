import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import SaveIcon from "@mui/icons-material/Save";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { apiFetch, patchJson, postJson } from "../api/client";
import type { HolmesStatus, Settings } from "../types/api";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    holmesApiUrl: "",
    holmesApiKey: "",
    clearHolmesApiKey: false,
    defaultModel: "",
    timezone: "",
    currentPassword: "",
    newAdminPassword: ""
  });
  const [message, setMessage] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<{ settings: Settings }>("/api/settings")
  });

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) return;
    setForm((current) => ({
      ...current,
      holmesApiUrl: settings.holmesApiUrl,
      defaultModel: settings.defaultModel,
      timezone: settings.timezone
    }));
  }, [settingsQuery.data?.settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      patchJson<{ settings: Settings }>("/api/settings", {
        holmesApiUrl: form.holmesApiUrl,
        holmesApiKey: form.holmesApiKey || undefined,
        clearHolmesApiKey: form.clearHolmesApiKey,
        defaultModel: form.defaultModel,
        timezone: form.timezone,
        currentPassword: form.currentPassword || undefined,
        newAdminPassword: form.newAdminPassword || undefined
      }),
    onSuccess: () => {
      setMessage("Settings saved");
      setForm((current) => ({ ...current, holmesApiKey: "", clearHolmesApiKey: false, currentPassword: "", newAdminPassword: "" }));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["holmes-status"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to save settings")
  });

  const testMutation = useMutation({
    mutationFn: () => postJson<{ status: HolmesStatus }>("/api/settings/test-holmes")
  });

  const settings = settingsQuery.data?.settings;
  const status = testMutation.data?.status;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Settings" subtitle="Basic connection, model, timezone, and admin controls." />
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "minmax(0, 720px) 360px", gap: 2 }}>
        <Stack spacing={2}>
          {message ? <Alert severity={message === "Settings saved" ? "success" : "error"}>{message}</Alert> : null}
          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>
              Holmes Connection
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Holmes API URL"
                value={form.holmesApiUrl}
                onChange={(event) => setForm({ ...form, holmesApiUrl: event.target.value })}
                fullWidth
              />
              <TextField
                label={settings?.hasHolmesApiKey ? "Replace API key" : "API key"}
                value={form.holmesApiKey}
                onChange={(event) => setForm({ ...form, holmesApiKey: event.target.value })}
                type="password"
                fullWidth
              />
              {settings?.hasHolmesApiKey ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Switch
                    checked={form.clearHolmesApiKey}
                    onChange={(event) => setForm({ ...form, clearHolmesApiKey: event.target.checked })}
                  />
                  <Typography variant="body2">Clear stored Holmes API key</Typography>
                </Stack>
              ) : null}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Default model"
                  value={form.defaultModel}
                  onChange={(event) => setForm({ ...form, defaultModel: event.target.value })}
                  fullWidth
                />
                <TextField
                  label="Timezone"
                  value={form.timezone}
                  onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                  fullWidth
                />
              </Stack>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>
              Admin Password
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Current password"
                value={form.currentPassword}
                onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
                type="password"
                fullWidth
              />
              <TextField
                label="New password"
                value={form.newAdminPassword}
                onChange={(event) => setForm({ ...form, newAdminPassword: event.target.value })}
                type="password"
                fullWidth
              />
            </Stack>
          </Paper>

          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Save settings
            </Button>
            <Button variant="outlined" startIcon={<ScienceOutlinedIcon />} onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
              Test Holmes
            </Button>
          </Stack>
        </Stack>

        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", height: "fit-content" }}>
          <Typography variant="h5" gutterBottom>
            Connection Test
          </Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">Health</Typography>
              <StatusPill value={status?.healthz === "ok" ? "success" : status ? "error" : "unknown"} />
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">Ready</Typography>
              <StatusPill value={status?.readyz === "ok" ? "success" : status ? "error" : "unknown"} />
            </Stack>
            <Divider />
            <Typography variant="caption" color="text.secondary">
              URL
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {form.holmesApiUrl || "-"}
            </Typography>
            {status?.errors?.length ? (
              <Alert severity="warning">
                {status.errors.map((error) => (
                  <Typography key={error} variant="body2">
                    {error}
                  </Typography>
                ))}
              </Alert>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
