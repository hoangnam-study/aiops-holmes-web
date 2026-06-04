import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import StorageIcon from "@mui/icons-material/Storage";
import ScheduleIcon from "@mui/icons-material/Schedule";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import PsychologyIcon from "@mui/icons-material/Psychology";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import type { HolmesStatus } from "../types/api";
import { useAuth } from "../hooks/useAuth";

const drawerWidth = 244;

const navItems = [
  { label: "Chat", path: "/chat", icon: <ChatBubbleOutlineIcon fontSize="small" /> },
  { label: "Incidents", path: "/incidents", icon: <ReportProblemOutlinedIcon fontSize="small" /> },
  { label: "Clusters", path: "/clusters", icon: <HubOutlinedIcon fontSize="small" />, roles: ["admin", "operator"] },
  { label: "Data Sources", path: "/data-sources", icon: <StorageIcon fontSize="small" />, roles: ["admin", "operator"] },
  { label: "Scheduled Prompts", path: "/scheduled-prompts", icon: <ScheduleIcon fontSize="small" />, roles: ["admin", "operator"] },
  { label: "Health Checks", path: "/health-checks", icon: <FactCheckOutlinedIcon fontSize="small" />, roles: ["admin", "operator"] },
  { label: "Notifications", path: "/notifications", icon: <NotificationsOutlinedIcon fontSize="small" />, roles: ["admin", "operator"] },
  { label: "Knowledge", path: "/knowledge", icon: <MenuBookIcon fontSize="small" />, roles: ["admin", "operator"] },
  { label: "Runbooks", path: "/runbooks", icon: <ChecklistOutlinedIcon fontSize="small" />, roles: ["admin", "operator"] },
  { label: "Admin", path: "/admin", icon: <ManageAccountsOutlinedIcon fontSize="small" />, roles: ["admin"] },
  { label: "Settings", path: "/settings", icon: <SettingsIcon fontSize="small" />, roles: ["admin"] }
];

export default function AppShell() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const statusQuery = useQuery({
    queryKey: ["holmes-status"],
    queryFn: () => apiFetch<HolmesStatus>("/api/holmes/status"),
    refetchInterval: 30_000,
    retry: false
  });
  const connected = statusQuery.data?.healthz === "ok" && statusQuery.data.readyz === "ok";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "#fbfcfd"
          }
        }}
      >
        <Stack sx={{ height: "100%", p: 1.5 }} spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: "#d8f8ea",
                color: "#35b988"
              }}
            >
              <PsychologyIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={800} noWrap>
                HolmesGPT
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                AIOps console
              </Typography>
            </Box>
          </Stack>

          <Chip
            label={connected ? "Connected" : "Disconnected"}
            color={connected ? "success" : "default"}
            size="small"
            variant={connected ? "filled" : "outlined"}
            sx={{ alignSelf: "flex-start", ml: 1, fontWeight: 700 }}
          />

          <Divider />

          <List dense sx={{ flex: 1 }}>
            {navItems.filter((item) => !item.roles || item.roles.includes(user?.role ?? "viewer")).map((item) => {
              const selected = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <ListItemButton
                  key={item.path}
                  component={NavLink}
                  to={item.path}
                  selected={selected}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    "&.Mui-selected": {
                      bgcolor: "#eaf1ff",
                      color: "primary.main",
                      borderLeft: "3px solid",
                      borderColor: "primary.main"
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34, color: "inherit" }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 700 : 500 }}
                  />
                </ListItemButton>
              );
            })}
          </List>

          <Divider />
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {user?.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role ?? "user"}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={() => void logout()}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Drawer>

      <Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </Box>
    </Box>
  );
}
