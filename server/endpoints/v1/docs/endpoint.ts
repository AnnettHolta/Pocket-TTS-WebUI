import type { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

export function registerDocsEndpoint(app: OpenAPIHono, specUrl: string) {
  app.get("/api/v1/docs", Scalar({
    url: specUrl,
    pageTitle: "PocketTTS API Reference",
    theme: "deepSpace",
    cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.82.1",
    hideClientButton: true,
  }));
}
