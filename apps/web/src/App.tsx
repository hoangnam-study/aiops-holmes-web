import { Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import IncidentsPage from "./pages/IncidentsPage";
import DataSourcesPage from "./pages/DataSourcesPage";
import ScheduledPromptsPage from "./pages/ScheduledPromptsPage";
import KnowledgePage from "./pages/KnowledgePage";
import SettingsPage from "./pages/SettingsPage";

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedApp />}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:threadId" element={<ChatPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/scheduled-prompts" element={<ScheduledPromptsPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
