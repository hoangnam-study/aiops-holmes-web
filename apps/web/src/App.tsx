import { Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import OverviewPage from "./pages/OverviewPage";
import IncidentsPage from "./pages/IncidentsPage";
import ChangesPage from "./pages/ChangesPage";
import DataSourcesPage from "./pages/DataSourcesPage";
import ClustersPage from "./pages/ClustersPage";
import ScheduledPromptsPage from "./pages/ScheduledPromptsPage";
import HealthChecksPage from "./pages/HealthChecksPage";
import KnowledgePage from "./pages/KnowledgePage";
import RunbooksPage from "./pages/RunbooksPage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminPage from "./pages/AdminPage";
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
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:threadId" element={<ChatPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/changes" element={<ChangesPage />} />
          <Route path="/clusters" element={<ClustersPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/scheduled-prompts" element={<ScheduledPromptsPage />} />
          <Route path="/health-checks" element={<HealthChecksPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/runbooks" element={<RunbooksPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
