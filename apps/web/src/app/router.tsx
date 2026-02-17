import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "./shell/AppShell";
import { PlaceholderScreen } from "./shell/PlaceholderScreen";
import { WeightRoute } from "../features/weight/routes/WeightRoute";
import { TodayRoute } from "../features/days/routes/TodayRoute";
import { DayRoute } from "../features/days/routes/DayRoute";
import { TargetsRoute } from "../features/targets/routes/TargetsRoute";
import { RecipesListRoute } from "../features/recipes/routes/RecipesListRoute";
import { RecipeBuilderRoute } from "../features/recipes/routes/RecipeBuilderRoute";
import { RecipeDetailsRoute } from "../features/recipes/routes/RecipeDetailsRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: "today", element: <TodayRoute /> },
      { path: "day/:date", element: <DayRoute /> },
      { path: "plan", element: <PlaceholderScreen title="Plan" /> },
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
