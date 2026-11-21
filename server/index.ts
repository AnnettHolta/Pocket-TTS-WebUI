import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { endpoints } from "./endpoints/index.ts";
import { resolveLanguagesOnStartup } from "./hf.ts";

const server = new Hono();
server.route("/", endpoints);

const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
if (production && existsSync("dist")) {
  server.use("/*", serveStatic({ root: "./dist" }));
  server.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST ?? "127.0.0.1";

serve({ fetch: server.fetch, port, hostname }, (info) => {
  console.log(`[hono] Server listening on http://${hostname}:${info.port}`);
  void resolveLanguagesOnStartup();
});
