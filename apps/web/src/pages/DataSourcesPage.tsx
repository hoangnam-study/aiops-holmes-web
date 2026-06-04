import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import MarkdownMessage from "../components/MarkdownMessage";
import { apiFetch, postJson } from "../api/client";
import type { DataSource } from "../types/api";

export default function DataSourcesPage() {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState("");

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
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />}>
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
                    {selected.toolsetKey ? <Typography variant="caption">{selected.toolsetKey}</Typography> : null}
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
                      disabled={verifyMutation.isPending}
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
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">No data source selected.</Typography>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
