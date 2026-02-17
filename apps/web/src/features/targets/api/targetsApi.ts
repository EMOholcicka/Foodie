import { http } from "../../../shared/api/http";

export type Targets = {
  id: string;
  effective_date: string | null;
  kcal_target: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type TargetsPutRequest = {
  effective_date?: string | null;
  kcal_target: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export async function getTargets(): Promise<Targets> {
  const { data } = await http.get<Targets>("/targets");
  return data;
}

export async function putTargets(payload: TargetsPutRequest): Promise<Targets> {
  const { data } = await http.put<Targets>("/targets", payload);
  return data;
}
