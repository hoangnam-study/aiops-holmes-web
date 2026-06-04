import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import PsychologyIcon from "@mui/icons-material/Psychology";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("holmes-admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/chat" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, bgcolor: "#f7f9fb" }}>
      <Paper sx={{ width: "100%", maxWidth: 420, p: 3, border: "1px solid", borderColor: "divider" }} elevation={0}>
        <Stack spacing={2.5} component="form" onSubmit={submit}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "#d8f8ea", color: "#35b988" }}>
              <PsychologyIcon />
            </Box>
            <Box>
              <Typography variant="h5">HolmesGPT UI</Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to your AIOps console
              </Typography>
            </Box>
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth />
          <TextField
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={loading} size="large">
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
