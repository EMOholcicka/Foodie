import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-mode contract:
 * - Frontend calls the API via `/api/*`
 * - Vite dev server proxies `/api/*` to the backend
 * - Proxy strips the `/api` prefix so backend routes are mounted at `/` (e.g. `/healthz`)
 *
 * This prevents accidental requests to the Vite server itself (which would return index.html).
 */
export default defineConfig(() => {
  // In Docker compose, this is provided via `web.environment.VITE_API_PROXY_TARGET`.
  // Locally, you can set it in `.env`/`.env.local` or fall back to the host API port mapping.
  const proxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.tsx"],
      globals: true,
      css: true,
    },
  };
});
