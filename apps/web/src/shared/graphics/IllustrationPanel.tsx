import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type IllustrationPanelProps = {
  illustration: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Reusable panel for empty/error states.
 */
export function IllustrationPanel({ illustration, title, description, actions, className }: IllustrationPanelProps) {
  return (
    <Box
      component="section"
      className={className}
      aria-label={title}
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "minmax(180px, 260px) 1fr" },
        gap: 2,
        alignItems: "center",
        p: 2,
        borderRadius: 2,
        // `theme.vars` exists only when using CssVarsProvider (Joy / Material CSS variables).
        // App currently uses ThemeProvider(createTheme), so rely on standard theme.palette.
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
      })}
    >
      <Box sx={{ width: "100%", maxWidth: 260 }} aria-hidden>
        {illustration}
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 650, letterSpacing: -0.2 }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.4 }}>
            {description}
          </Typography>
        ) : null}
        {actions ? <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box> : null}
      </Box>
    </Box>
  );
}
