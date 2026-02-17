import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateWeeklyPlan,
  getWeeklyGroceryList,
  getWeeklyPlan,
  swapWeeklyPlanMeal,
  type GroceryListResponse,
  type SwapWeeklyPlanMealRequest,
  type WeeklyPlan,
  type WeeklyPlanGenerateRequest,
} from "./plansApi";

export const plansQueryKeys = {
  root: ["plans"] as const,
  weekly: (weekStart: string) => [...plansQueryKeys.root, "weekly", weekStart] as const,
  groceryList: (weekStart: string) => [...plansQueryKeys.root, "weekly", weekStart, "grocery-list"] as const,
};

export function useWeeklyPlanQuery(weekStart: string) {
  return useQuery({
    queryKey: plansQueryKeys.weekly(weekStart),
    queryFn: () => getWeeklyPlan(weekStart),
    enabled: !!weekStart,
    retry: false,
  });
}

export function useWeeklyGroceryListQuery(weekStart: string) {
  return useQuery({
    queryKey: plansQueryKeys.groceryList(weekStart),
    queryFn: () => getWeeklyGroceryList(weekStart),
    enabled: !!weekStart,
    retry: false,
  });
}

export function useGenerateWeeklyPlanMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: WeeklyPlanGenerateRequest) => generateWeeklyPlan(payload),
    onSuccess: async (data: WeeklyPlan) => {
      // We already updated the weekly plan cache with setQueryData, so avoid a redundant
      // invalidate/refetch of the same query key. Only invalidate dependent queries.
      qc.setQueryData(plansQueryKeys.weekly(data.week_start), data);
      await qc.invalidateQueries({ queryKey: plansQueryKeys.groceryList(data.week_start) });
    },
  });
}

export function useSwapWeeklyPlanMealMutation(weekStart: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: SwapWeeklyPlanMealRequest) => swapWeeklyPlanMeal(weekStart, payload),
    onSuccess: async (data: WeeklyPlan) => {
      qc.setQueryData(plansQueryKeys.weekly(data.week_start), data);
      await qc.invalidateQueries({ queryKey: plansQueryKeys.groceryList(data.week_start) });
    },
  });
}

export function prefillGroceryListStateKey(weekStart: string) {
  return `foodie.grocery.${weekStart}`;
}

export function loadGroceryCheckedMap(weekStart: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(prefillGroceryListStateKey(weekStart));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function storeGroceryCheckedMap(weekStart: string, map: Record<string, boolean>) {
  localStorage.setItem(prefillGroceryListStateKey(weekStart), JSON.stringify(map));
}

export function groceryListToClipboardText(data: GroceryListResponse, mode: "category" | "recipe") {
  const items = data.items.slice().sort((a, b) => a.name.localeCompare(b.name));
  const groupKey = (it: (typeof items)[number]) => {
    if (mode === "recipe") return it.recipe_name ?? "Other";
    return it.category ?? "Other";
  };

  const grouped = new Map<string, (typeof items)[number][]>();
  for (const it of items) {
    const k = groupKey(it);
    grouped.set(k, [...(grouped.get(k) ?? []), it]);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, arr]) => {
      const lines = arr
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => `- ${i.name}: ${Math.round(i.grams)} g`);
      return `${k}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

export function groceryListToCsv(data: GroceryListResponse) {
  const escape = (v: string) => {
    const s = v.replaceAll('"', '""');
    return `"${s}"`;
  };

  const header = ["name", "grams", "category", "recipe"].join(",");
  const rows = data.items
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((i) => [escape(i.name), `${i.grams}`, escape(i.category ?? ""), escape(i.recipe_name ?? "")].join(","));
  return [header, ...rows].join("\n");
}
