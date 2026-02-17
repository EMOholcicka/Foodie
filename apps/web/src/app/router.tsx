import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "./shell/AppShell";
import { PlaceholderScreen } from "./shell/PlaceholderScreen";
import { WeeklyPlanRoute } from "../features/plans/routes/WeeklyPlanRoute";
import { GroceryListRoute } from "../features/plans/routes/GroceryListRoute";
import { WeightRoute } from "../features/weight/routes/WeightRoute";
import { TodayRoute } from "../features/days/routes/TodayRoute";
import { DayRoute } from "../features/days/routes/DayRoute";
import { TargetsRoute } from "../features/targets/routes/TargetsRoute";
import { RecipesListRoute } from "../features/recipes/routes/RecipesListRoute";
import { RecipeBuilderRoute } from "../features/recipes/routes/RecipeBuilderRoute";
import { RecipeDetailsRoute } from "../features/recipes/routes/RecipeDetailsRoute";
import { AuthRoute } from "../features/auth/routes/AuthRoute";
import { RequireAuth } from "./RequireAuth";

export const router = createBrowserRouter([
  {
    path: "/auth",
    element: <AuthRoute />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: "today", element: <TodayRoute /> },
      { path: "day/:date", element: <DayRoute /> },
      { path: "plan", element: <WeeklyPlanRoute /> },
      { path: "plan/grocery", element: <GroceryListRoute /> },
      { path: "recipes", element: <RecipesListRoute /> },
      { path: "recipes/new", element: <RecipeBuilderRoute /> },
      { path: "recipes/:recipeId", element: <RecipeDetailsRoute /> },
      { path: "recipes/:recipeId/edit", element: <RecipeBuilderRoute /> },
      { path: "weight", element: <WeightRoute /> },
      { path: "targets", element: <TargetsRoute /> },
      { path: "settings", element: <PlaceholderScreen title="Settings" /> },
      { path: "*", element: <Navigate to="/today" replace /> },
    ],
  },
]);
