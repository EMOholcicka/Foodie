import { Container, Typography } from "@mui/material";

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography color="text.secondary">Not implemented in Phase 3.</Typography>
    </Container>
  );
}
