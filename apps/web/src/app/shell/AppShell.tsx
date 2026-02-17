import EventNoteIcon from "@mui/icons-material/EventNote";
import LogoutIcon from "@mui/icons-material/Logout";
import MonitorWeightIcon from "@mui/icons-material/MonitorWeight";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import SettingsIcon from "@mui/icons-material/Settings";
import TodayIcon from "@mui/icons-material/Today";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Container,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { clearTokens } from "../../shared/api/auth";

const navItems = [
  { label: "Today", icon: <TodayIcon />, to: "/today" },
  { label: "Plan", icon: <EventNoteIcon />, to: "/plan" },
  { label: "Recipes", icon: <RestaurantMenuIcon />, to: "/recipes" },
  { label: "Weight", icon: <MonitorWeightIcon />, to: "/weight" },
  { label: "Targets", icon: <TrackChangesIcon />, to: "/targets" },
  { label: "Settings", icon: <SettingsIcon />, to: "/settings" },
] as const;

function useNavValue() {
  const location = useLocation();
  const match = navItems.findIndex((i) => location.pathname.startsWith(i.to));
  return match === -1 ? 0 : match;
}

export function AppShell() {
  const navigate = useNavigate();
  const value = useNavValue();

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          // fallback for browsers without backdrop-filter support
          bgcolor: (t) => `${t.palette.background.default}cc`,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          backgroundImage: (t) =>
            `linear-gradient(180deg, ${t.palette.background.default}cc 0%, ${t.palette.background.default}66 100%)`,
        }}
      >
        <Toolbar>
          <Container
            maxWidth="md"
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
          >
            <Typography variant="h6">Foodie</Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Phase 7
              </Typography>

              <Tooltip title="Logout">
                <IconButton
                  aria-label="Logout"
                  color="inherit"
                  onClick={() => {
                    clearTokens();
                    navigate("/auth", { replace: true });
                  }}
                  sx={{ minHeight: 44, minWidth: 44 }}
                >
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Container>
        </Toolbar>
      </AppBar>

      {/* Spacer that matches MUI Toolbar minHeight (56px xs / 64px sm+) */}
      <Toolbar />

      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: "background.paper",
          zIndex: (t) => t.zIndex.appBar,
        }}
      >
        <Container maxWidth="md" disableGutters>
          <BottomNavigation showLabels value={value} onChange={(_, next) => navigate(navItems[next]!.to)}>
            {navItems.map((i) => (
              <BottomNavigationAction key={i.to} label={i.label} icon={i.icon} />
            ))}
          </BottomNavigation>
        </Container>
      </Box>
    </Box>
  );
}
