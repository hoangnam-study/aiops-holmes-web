import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyIcon from "@mui/icons-material/Key";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { apiFetch, postJson } from "../api/client";
import type { Agent, Cluster } from "../types/api";

dayjs.extend(relativeTime);

export default function ClustersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", slug: "", environment: "", apiUrl: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken] = useState("");

  const clustersQuery = useQuery({
    queryKey: ["clusters"],
    queryFn: () => apiFetch<{ clusters: Cluster[] }>("/api/clusters")
  });
  const selectedClusterId = selectedId ?? clustersQuery.data?.clusters[0]?._id ?? "";
  const agentsQuery = useQuery({
    queryKey: ["cluster-agents", selectedClusterId],
    queryFn: () => apiFetch<{ agents: Agent[] }>(`/api/clusters/${selectedClusterId}/agents`),
    enabled: Boolean(selectedClusterId),
    refetchInterval: 30_000
  });

  const createCluster = useMutation({
    mutationFn: () => postJson<{ cluster: Cluster; enrollmentToken: string }>("/api/clusters", form),
    onSuccess: (payload) => {
      setForm({ name: "", slug: "", environment: "", apiUrl: "" });
      setSelectedId(payload.cluster._id);
      setToken(payload.enrollmentToken);
      queryClient.invalidateQueries({ queryKey: ["clusters"] });
    }
  });

  const rotateToken = useMutation({
    mutationFn: (id: string) => postJson<{ cluster: Cluster; enrollmentToken: string }>(`/api/clusters/${id}/enrollment-token`),
    onSuccess: (payload) => {
      setToken(payload.enrollmentToken);
      queryClient.invalidateQueries({ queryKey: ["clusters"] });
    }
  });

  const clusters = clustersQuery.data?.clusters ?? [];
  const selected = clusters.find((cluster) => cluster._id === selectedClusterId);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Clusters" subtitle="Registered clusters, enrollment tokens, and Holmes agent heartbeats." />
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 430px", gap: 2 }}>
        <Stack spacing={2}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Register Cluster</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} fullWidth />
              <TextField label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} fullWidth />
              <TextField label="Environment" value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value })} fullWidth />
              <TextField label="API URL" value={form.apiUrl} onChange={(event) => setForm({ ...form, apiUrl: event.target.value })} fullWidth />
              <Button variant="contained" startIcon={<AddIcon />} disabled={!form.name || !form.slug || createCluster.isPending} onClick={() => createCluster.mutate()}>
                Cluster
              </Button>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Clusters</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Environment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Heartbeat</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clusters.map((cluster) => (
                  <TableRow key={cluster._id} hover selected={cluster._id === selectedClusterId} onClick={() => setSelectedId(cluster._id)} sx={{ cursor: "pointer" }}>
                    <TableCell>{cluster.name}</TableCell>
                    <TableCell>{cluster.slug}</TableCell>
                    <TableCell>{cluster.environment ?? "-"}</TableCell>
                    <TableCell><StatusPill value={cluster.status} /></TableCell>
                    <TableCell>{cluster.lastHeartbeatAt ? dayjs(cluster.lastHeartbeatAt).fromNow() : "Never"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>

        <Stack spacing={2}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5">Enrollment</Typography>
              {selected ? (
                <Button variant="outlined" startIcon={<KeyIcon />} onClick={() => rotateToken.mutate(selected._id)}>
                  Rotate token
                </Button>
              ) : null}
            </Stack>
            {selected ? (
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Typography fontWeight={800}>{selected.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Agents should heartbeat to `/api/agents/heartbeat` with header `X-Agent-Token`.
                </Typography>
                {token ? <Alert severity="success" sx={{ wordBreak: "break-all" }}>{token}</Alert> : null}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Create or select a cluster to manage enrollment.</Typography>
            )}
          </Paper>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h5" gutterBottom>Agents</Typography>
            <Stack spacing={1.25}>
              {(agentsQuery.data?.agents ?? []).map((agent) => (
                <Paper key={agent._id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={800}>{agent.agentId}</Typography>
                    <StatusPill value={agent.status} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{agent.version ?? "unknown version"}</Typography>
                  <Typography variant="caption" color="text.secondary">{dayjs(agent.lastHeartbeatAt).fromNow()}</Typography>
                </Paper>
              ))}
              {!agentsQuery.data?.agents.length ? (
                <Typography variant="body2" color="text.secondary">No agents have checked in yet.</Typography>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}
