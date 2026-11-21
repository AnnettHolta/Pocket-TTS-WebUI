import { readFile } from "node:fs/promises";
import type { OpenAPIHono } from "@hono/zod-openapi";

const instructions = new URL("../../../llms.txt", import.meta.url);

export function registerLlmsEndpoint(app: OpenAPIHono) {
  app.get("/llms.txt", async (c) => c.text(await readFile(instructions, "utf8")));
}
