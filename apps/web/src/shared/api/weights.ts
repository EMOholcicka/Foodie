import { http } from "./http";

export type WeightEntry = {
  id: string;
  datetime: string; // ISO
  weight_kg: number;
  note: string | null;
};

export type WeightListResponse = {
  items: WeightEntry[];
};

export type CreateWeightRequest = {
  datetime: string;
  weight_kg: number;
  note?: string | null;
};

export type UpdateWeightRequest = {
  datetime?: string;
  weight_kg?: number;
  note?: string | null;
};

export async function listWeights(params?: { from?: string; to?: string }): Promise<WeightEntry[]> {
  const { data } = await http.get<WeightListResponse>("/weights", { params });
  return data.items;
}

export async function createWeight(req: CreateWeightRequest): Promise<WeightEntry> {
  const { data } = await http.post<WeightEntry>("/weights", req);
  return data;
}

export async function updateWeight(id: string, req: UpdateWeightRequest): Promise<WeightEntry> {
  const { data } = await http.patch<WeightEntry>(`/weights/${id}`, req);
  return data;
}

export async function deleteWeight(id: string): Promise<void> {
  await http.delete(`/weights/${id}`);
}
