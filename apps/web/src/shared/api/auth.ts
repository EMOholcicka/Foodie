import { http, setAccessToken } from "./http";

export type RegisterRequest = {
  email: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

const ACCESS_TOKEN_STORAGE_KEY = "foodie.access_token";
const REFRESH_TOKEN_STORAGE_KEY = "foodie.refresh_token";

export function loadStoredAccessToken(): string | null {
  const t = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  return t && t.length > 0 ? t : null;
}

export function loadStoredRefreshToken(): string | null {
  const t = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  return t && t.length > 0 ? t : null;
}

export function storeTokens(tokens: { accessToken: string | null; refreshToken: string | null }) {
  const { accessToken, refreshToken } = tokens;

  if (accessToken) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  else localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);

  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);

  setAccessToken(accessToken);
}

export function storeAccessToken(token: string | null) {
  storeTokens({ accessToken: token, refreshToken: loadStoredRefreshToken() });
}

export function clearTokens() {
  storeTokens({ accessToken: null, refreshToken: null });
}

export async function register(req: RegisterRequest): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>("/auth/register", req);
  storeTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
  return data;
}

export async function login(req: LoginRequest): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>("/auth/login", req);
  storeTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
  return data;
}

export async function refresh(): Promise<AuthResponse> {
  const refreshToken = loadStoredRefreshToken();
  if (!refreshToken) throw new Error("Missing refresh token");

  const { data } = await http.post<AuthResponse>("/auth/refresh", { refresh_token: refreshToken });
  storeTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
  return data;
}

export function initAuthFromStorage() {
  setAccessToken(loadStoredAccessToken());
}
