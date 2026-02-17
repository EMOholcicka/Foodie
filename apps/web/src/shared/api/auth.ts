import { http, setAccessToken } from "./http";

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

const STORAGE_KEY = "foodie.access_token";

export function loadStoredAccessToken(): string | null {
  const t = localStorage.getItem(STORAGE_KEY);
  return t && t.length > 0 ? t : null;
}

export function storeAccessToken(token: string | null) {
  if (token) localStorage.setItem(STORAGE_KEY, token);
  else localStorage.removeItem(STORAGE_KEY);
  setAccessToken(token);
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>("/auth/login", req);
  storeAccessToken(data.access_token);
  return data;
}

export function initAuthFromStorage() {
  setAccessToken(loadStoredAccessToken());
}
