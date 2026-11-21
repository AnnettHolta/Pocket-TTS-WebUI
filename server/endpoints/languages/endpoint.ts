import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { listLanguages } from "../../hf.ts";
import { listLanguagesResponses } from "./response.ts";

const route = createRoute({
  method: "get",
  path: "/api/languages",
  hide: true,
  responses: listLanguagesResponses,
});

export function registerListLanguagesEndpoint(app: OpenAPIHono) {
  app.openapi(route, async (c) => c.json({ languages: await listLanguages() }, 200));
}
