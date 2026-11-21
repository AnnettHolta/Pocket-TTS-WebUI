import { getRequestListener } from "@hono/node-server";
import { defineConfig, type Connect, type Plugin } from "vite";
import solid from "@solidjs/vite-plugin";
import { endpoints } from "./server/endpoints/index.ts";
import { resolveLanguagesOnStartup } from "./server/hf.ts";

function modelCache(): Plugin {
  const install = (server: { middlewares: Connect.Server }) => {
    const handleRequest = getRequestListener(endpoints.fetch, { overrideGlobalObjects: false });
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split("?", 1)[0];
      if (path === "/llms.txt" || path?.startsWith("/api/") || path?.startsWith("/models/pocket-tts/")) {
        return handleRequest(req, res);
      }
      next();
    });
    void resolveLanguagesOnStartup();
  };

  return {
    name: "pocket-tts-model-cache",
    configureServer: install,
    configurePreviewServer: install,
  };
}

export default defineConfig({
  plugins: [solid(), modelCache()],
  worker: {
    format: "es",
  },
  build: {
    copyPublicDir: false,
  },
});
