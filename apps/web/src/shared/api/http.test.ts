import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setupAxiosMock() {
  const requestMock = vi.fn(async (cfg: any) => ({ data: { ok: true }, config: cfg, headers: {} }));

  vi.doMock("axios", () => {
    class AxiosError extends Error {
      response?: any;
      config?: any;
      request?: any;
      constructor(message: string, code?: string, config?: any, request?: any, response?: any) {
        super(message);
        this.name = "AxiosError";
        this.config = config;
        this.request = request;
        this.response = response;
      }
    }

    const instance: any = {
      interceptors: {
        request: { use: vi.fn((fn: any) => (instance.__onRequest = fn)) },
        response: {
          use: vi.fn((onFulfilled: any, onRejected: any) => {
            instance.__onRejected = onRejected;
            instance.__onFulfilled = onFulfilled;
          }),
        },
      },
      request: requestMock,
    };

    return {
      default: {
        create: vi.fn(() => instance),
      },
      AxiosError,
    };
  });

  return { requestMock };
}

beforeEach(() => {
  vi.resetModules();
  (globalThis as any).window = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("http refresh interceptor", () => {
  it("on 401 refreshes once, retries original request, and dedupes concurrent refreshes", async () => {
    const assignSpy = vi.fn();
    (globalThis as any).window = {
      location: { pathname: "/today", search: "", assign: assignSpy },
    };

    const clearTokens = vi.fn();
    const refresh = vi.fn(async () => ({ access_token: "newA", refresh_token: "newR", token_type: "bearer" as const }));

    vi.doMock("./auth", () => ({ refresh, clearTokens }));

    const { requestMock } = setupAxiosMock();

    const { http } = await import("./http");

    const error401a: any = new Error("401");
    error401a.config = { url: "/foods", method: "get", headers: {} };
    error401a.response = { status: 401 };

    const error401b: any = new Error("401");
    error401b.config = { url: "/foods", method: "get", headers: {} };
    error401b.response = { status: 401 };

    const p1 = (http as any).__onRejected(error401a);
    const p2 = (http as any).__onRejected(error401b);

    const res = await Promise.all([p1, p2]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(2);

    const retriedCfg = requestMock.mock.calls[0][0];
    expect(retriedCfg.headers.Authorization).toBe("Bearer newA");

    // Also ensure shared state update affects subsequent requests via request interceptor.
    const cfg: any = { url: "/foods", headers: {} };
    const cfgAfter = (http as any).__onRequest(cfg);
    expect(cfgAfter.headers.Authorization).toBe("Bearer newA");

    expect(res[0].data.ok).toBe(true);
    expect(res[1].data.ok).toBe(true);
  });

  it("does not attempt refresh for /auth/* endpoints", async () => {
    const refresh = vi.fn(async () => ({ access_token: "newA" }));
    const clearTokens = vi.fn();
    vi.doMock("./auth", () => ({ refresh, clearTokens }));

    const { requestMock } = setupAxiosMock();
    const { http } = await import("./http");

    const err: any = new Error("401");
    err.config = { url: "/auth/login", method: "post", headers: {} };
    err.response = { status: 401 };

    await expect((http as any).__onRejected(err)).rejects.toBe(err);
    expect(refresh).toHaveBeenCalledTimes(0);
    expect(requestMock).toHaveBeenCalledTimes(0);
  });

  it("honors _retry guard (no second refresh attempt)", async () => {
    const refresh = vi.fn(async () => ({ access_token: "newA" }));
    const clearTokens = vi.fn();
    vi.doMock("./auth", () => ({ refresh, clearTokens }));

    setupAxiosMock();
    const { http } = await import("./http");

    const err: any = new Error("401");
    err.config = { url: "/foods", method: "get", headers: {}, _retry: true };
    err.response = { status: 401 };

    await expect((http as any).__onRejected(err)).rejects.toBe(err);
    expect(refresh).toHaveBeenCalledTimes(0);
  });

  it("on refresh failure clears tokens and redirects to /auth with reason=expired", async () => {
    const assignSpy = vi.fn();
    (globalThis as any).window = {
      location: { pathname: "/today", search: "?x=1", assign: assignSpy },
    };

    const clearTokens = vi.fn();
    const refreshErr = new Error("refresh failed");
    const refresh = vi.fn(async () => {
      throw refreshErr;
    });

    vi.doMock("./auth", () => ({ refresh, clearTokens }));

    const { requestMock } = setupAxiosMock();
    const { http } = await import("./http");

    const err: any = new Error("401");
    err.config = { url: "/foods", method: "get", headers: {} };
    err.response = { status: 401 };

    await expect((http as any).__onRejected(err)).rejects.toBe(refreshErr);

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(String(assignSpy.mock.calls[0][0])).toMatch(/^\/auth\?reason=expired&next=/);
    expect(requestMock).toHaveBeenCalledTimes(0);
  });
});
