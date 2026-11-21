import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

export function createApp() {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join(".");
        return c.json({ error: field ? `${field}: ${issue.message}` : issue.message }, 400);
      }
    },
  });

  return app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error("[hono] Request failed:", error);
    return c.json({ error: "Internal server error." }, 500);
  });
}
