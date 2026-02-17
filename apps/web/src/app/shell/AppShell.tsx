import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
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
  Toolbar,
  Typography,
} from "@mui/material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { label: "Today", icon: <TodayIcon />, to: "/today" },
  { label: "Plan", icon: <FitnessCenterIcon />, to: "/plan" },
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
      <AppBar position="sticky" elevation={0} color="transparent">
        <Toolbar>
          <Container
            maxWidth="md"
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="h6">Foodie</Typography>
            <Typography variant="caption" color="text.secondary">
              Phase 5
            </Typography>
          </Container>
        </Toolbar>
      </AppBar>

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
          <BottomNavigation
            showLabels
            value={value}
            onChange={(_, next) => navigate(navItems[next]!.to)}
          >
            {navItems.map((i) => (
              <BottomNavigationAction key={i.to} label={i.label} icon={i.icon} />
            ))}
          </BottomNavigation>
        </Container>
      </Box>
    </Box>
  );
}
