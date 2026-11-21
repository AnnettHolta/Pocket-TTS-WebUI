import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { ensureLanguageModelDownloaded } from "../../../../hf.ts";
import { modelBasePath } from "../../../../modelSource.ts";
import { prepareLanguageBody, prepareLanguageParams } from "./request.ts";
import { prepareLanguageResponses } from "./response.ts";

const route = createRoute({
  method: "post",
  path: "/api/languages/{id}/prepare",
  hide: true,
  request: {
    params: prepareLanguageParams,
    body: { content: { "application/json": { schema: prepareLanguageBody } } },
  },
  responses: prepareLanguageResponses,
});

export function registerPrepareLanguageEndpoint(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { id } = c.req.valid("param");
    const { precision = "mixed", includeEncoder = false } = c.req.valid("json");

    try {
      const result = await ensureLanguageModelDownloaded(id, precision, includeEncoder);
      return c.json({ ok: true, baseUrl: modelBasePath(id), ...result }, 200);
    } catch (error) {
      return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }, (result, c) => {
    if (!result.success) return c.json({ ok: false, error: result.error.issues[0].message }, 400);
  });
}
