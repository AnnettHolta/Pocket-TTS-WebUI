import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { getVerifiedModelFile } from "../../../../../../hf.ts";
import { MODEL_REVISION } from "../../../../../../modelSource.ts";
import { modelFileParams, modelFilePath } from "./request.ts";
import { modelFileResponses } from "./response.ts";

const route = createRoute({
  method: "get",
  path: "/models/pocket-tts/{revision}/{lang}/{file}",
  hide: true,
  request: { params: modelFileParams },
  responses: modelFileResponses,
});

export function registerModelFileEndpoint(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { revision, lang, file } = c.req.valid("param");
    if (revision !== MODEL_REVISION) return c.text("Not found", 404);
    if (!modelFilePath.safeParse({ lang, file }).success) return c.text("Forbidden", 403);

    const cached = await getVerifiedModelFile(lang, file);
    if (!cached) return c.text("Not found", 404);

    const data = Readable.toWeb(createReadStream(cached.filePath)) as ReadableStream<Uint8Array>;
    return c.body(data, 200, {
      "Content-Type": file.endsWith(".json") ? "application/json; charset=utf-8" : "application/octet-stream",
      "Content-Length": String(cached.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });
}
