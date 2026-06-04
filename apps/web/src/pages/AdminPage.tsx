import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import dayjs from "dayjs";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { apiFetch, deleteJson, patchJson, postJson } from "../api/client";
import type { AuditLog, User } from "../types/api";

const roles = ["admin", "operator", "viewer"] as const;

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: "", password: "", role: "viewer" as User["role"] });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<{ users: User[] }>("/api/admin/users")
  });
  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => apiFetch<{ auditLogs: AuditLog[] }>("/api/admin/audit-logs"),
    refetchInterval: 30_000
  });

  const createUser = useMutation({
    mutationFn: () => postJson<{ user: User }>("/api/admin/users", form),
    onSuccess: () => {
      setForm({ email: "", password: "", role: "viewer" });
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Unable to create user")
  });

  const updateUser = useMutation({
    mutationFn: ({ id, role, password }: { id: string; role?: User["role"]; password?: string }) =>
      patchJson<{ user: User }>(`/api/admin/users/${id}`, {
        role,
        password: password || undefined
      }),
    onSuccess: () => {
      setPasswords({});
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    }
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    }
  });

  const users = usersQuery.data?.users ?? [];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Admin" subtitle="Local users, roles, and audit trail." />
      <Box sx={{ p: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 430px", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h5" gutterBottom>Users</Typography>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField label="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} fullWidth />
            <TextField label="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" fullWidth />
            <TextField label="Role" select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as User["role"] })} fullWidth>
              {roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
            </TextField>
            <Button variant="contained" startIcon={<AddIcon />} disabled={!form.email || !form.password || createUser.isPending} onClick={() => createUser.mutate()}>
              User
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>New password</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={user.role}
                      onChange={(event) => updateUser.mutate({ id: user.id, role: event.target.value as User["role"] })}
                      sx={{ minWidth: 130 }}
                    >
                      {roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="password"
                      value={passwords[user.id] ?? ""}
                      onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })}
                      placeholder="Reset password"
                    />
                  </TableCell>
                  <TableCell>{user.createdAt ? dayjs(user.createdAt).format("YYYY-MM-DD") : "-"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => updateUser.mutate({ id: user.id, password: passwords[user.id] })} disabled={!passwords[user.id]}>
                      <SaveIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => deleteUser.mutate(user.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", height: "fit-content" }}>
          <Typography variant="h5" gutterBottom>Audit Trail</Typography>
          <Stack spacing={1.25}>
            {(auditQuery.data?.auditLogs ?? []).map((log) => (
              <Paper key={log._id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={800}>{log.action}</Typography>
                  <StatusPill value={log.targetType} />
                </Stack>
                <Typography variant="body2" color="text.secondary">{log.actorEmail ?? "system"}</Typography>
                <Typography variant="caption" color="text.secondary">{dayjs(log.createdAt).format("YYYY-MM-DD HH:mm:ss")}</Typography>
              </Paper>
            ))}
            {!auditQuery.data?.auditLogs.length ? (
              <Typography variant="body2" color="text.secondary">No audit entries yet.</Typography>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
