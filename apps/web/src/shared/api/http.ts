import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

const baseURL = (import.meta as any).env?.VITE_API_BASE_URL ?? "/api";

function looksLikeHtml(payload: unknown): boolean {
  if (typeof payload !== "string") return false;
  const s = payload.trimStart().toLowerCase();
  return s.startsWith("<!doctype html") || s.startsWith("<html");
}

export const http = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  // If the API is misrouted, we often get HTML (Vite index.html). Accept text so we can detect this.
  transformResponse: [
    (data, headers) => {
      const contentType = String(headers?.["content-type"] ?? "").toLowerCase();
      if (contentType.includes("text/html") || looksLikeHtml(data)) {
        // Keep as string; response interceptor will throw a clearer error.
        return data;
      }
      // Default axios JSON parsing behavior
      if (typeof data === "string" && data.length) {
        try {
          return JSON.parse(data);
        } catch {
          // leave as-is; callers may expect plain text in some edge cases
        }
      }
      return data;
    },
  ],
});

let accessToken: string | null = null;

export function setAccessToken(next: string | null) {
  accessToken = next;
}

function setAuthHeader(config: AxiosRequestConfig, token: string | null) {
  if (!token) return;
  config.headers = config.headers ?? {};
  // Axios supports multiple header shapes; normalize to a plain object assignment.
  (config.headers as any).Authorization = `Bearer ${token}`;
}

http.interceptors.request.use((config) => {
  setAuthHeader(config, accessToken);
  return config;
});

function redirectToAuth(params?: { reason?: "expired" }) {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  sp.set("next", next);
  const url = `/auth?${sp.toString()}`;
  window.location.assign(url);
}

let refreshInFlight: Promise<string> | null = null;

async function getRefreshedAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const mod = await import("./auth");
      const data = await mod.refresh();
      return data.access_token;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function isAuthUrl(url: string): boolean {
  // Covers relative and absolute URLs.
  // We broadly exclude /auth/* from refresh attempts to prevent loops.
  return /(^|\/|:)auth\//.test(url) || url.includes("/auth/");
}

function shouldAttemptRefresh(status: number | undefined, originalConfig: any): boolean {
  if (status !== 401) return false;
  const url = String(originalConfig?.url ?? "");
  if (isAuthUrl(url)) return false;
  // Only once per request.
  if (originalConfig?._retry) return false;
  return true;
}

function installAuthRefreshInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => {
      const contentType = String(response.headers?.["content-type"] ?? "").toLowerCase();
      if (contentType.includes("text/html") || looksLikeHtml(response.data)) {
        const url = `${response.config.baseURL ?? ""}${response.config.url ?? ""}`;
        throw new AxiosError(
          `API request returned HTML instead of JSON. Likely missing Vite proxy or wrong baseURL. url=${url}`,
          "ERR_BAD_RESPONSE",
          response.config,
          response.request,
          response,
        );
      }
      return response;
    },
    async (error) => {
      const axiosErr = error as AxiosError;
      const status = axiosErr.response?.status;
      const originalConfig: any = axiosErr.config;

      if (!shouldAttemptRefresh(status, originalConfig)) return Promise.reject(error);

      try {
        originalConfig._retry = true;
        const nextAccessToken = await getRefreshedAccessToken();
        // Keep shared state consistent with the successful refresh so subsequent requests
        // (that go through the request interceptor) use the fresh access token.
        setAccessToken(nextAccessToken);

        setAuthHeader(originalConfig as AxiosRequestConfig, nextAccessToken);

        return instance.request(originalConfig as AxiosRequestConfig);
      } catch (refreshErr) {
        try {
          const mod = await import("./auth");
          mod.clearTokens();
        } finally {
          redirectToAuth({ reason: "expired" });
        }
        return Promise.reject(refreshErr);
      }
    },
  );
}

installAuthRefreshInterceptor(http);
