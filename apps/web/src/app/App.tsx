import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { RouterProvider } from "react-router-dom";

import { router } from "./router";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (t) => ({
        body: {
          // subtle depth for dark theme (vignette + gentle gradient)
          backgroundImage: `
            radial-gradient(1200px 700px at 50% -10%, ${t.palette.primary.main}22 0%, transparent 60%),
            radial-gradient(900px 600px at 0% 0%, #ffffff10 0%, transparent 55%),
            radial-gradient(900px 600px at 100% 0%, #ffffff0c 0%, transparent 55%),
            linear-gradient(180deg, ${t.palette.background.default} 0%, ${t.palette.background.default} 55%, #00000040 100%)
          `,
          backgroundAttachment: "scroll",
          "@media (min-width:900px)": {
            backgroundAttachment: "fixed",
          },
          backgroundRepeat: "no-repeat",
          backgroundColor: t.palette.background.default,
        },
      }),
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
