export type MacroTargets = {
  kcal_target: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function kcalFromMacros(macros: Pick<MacroTargets, "protein_g" | "carbs_g" | "fat_g">): number {
  return macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
}

export function mismatchInfo(targets: MacroTargets): { diff: number; tolerance: number; mismatched: boolean } {
  const kcalMacros = kcalFromMacros(targets);
  const diff = Math.abs(targets.kcal_target - kcalMacros);
  const tolerance = Math.max(50, targets.kcal_target * 0.05);
  return { diff, tolerance, mismatched: diff > tolerance };
}

export type TargetsMode = "kcal" | "macros";

export function getModeFromTargets(t: MacroTargets): TargetsMode {
  const hasAnyMacro = t.protein_g > 0 || t.carbs_g > 0 || t.fat_g > 0;
  return hasAnyMacro ? "macros" : "kcal";
}
