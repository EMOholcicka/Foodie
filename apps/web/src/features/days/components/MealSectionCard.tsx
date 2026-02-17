import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import type { Meal } from "../api/daysApi";

export type MealSectionCardProps = {
  meal: Meal;
  onAddEntry: () => void;
};

export function MealSectionCard(props: MealSectionCardProps) {
  const { meal } = props;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="h6" sx={{ textTransform: "capitalize" }}>
            {meal.meal_type}
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={props.onAddEntry}>
            Add
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {Math.round(meal.totals.kcal)} kcal • P {meal.totals.protein_g.toFixed(1)}g • C {meal.totals.carbs_g.toFixed(1)}g • F{" "}
          {meal.totals.fat_g.toFixed(1)}g
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        {meal.entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No entries yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {meal.entries.map((e) => (
              <Box key={e.id} sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" noWrap>
                    {e.food?.name ?? "Unknown food"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {e.food?.brand ?? ""}
                    {e.food?.brand ? " • " : ""}
                    {e.grams}g
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(e.macros.kcal)} kcal
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
