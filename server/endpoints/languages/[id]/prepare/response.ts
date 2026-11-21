import { z } from "@hono/zod-openapi";

export const prepareLanguageResponses = {
  200: {
    description: "Model files are ready.",
    content: {
      "application/json": {
        schema: z.object({
          ok: z.literal(true),
          baseUrl: z.string(),
          downloaded: z.array(z.string()),
          skipped: z.array(z.string()),
        }),
      },
    },
  },
  400: {
    description: "Invalid request or model preparation failed.",
    content: { "application/json": { schema: z.object({ ok: z.literal(false), error: z.string() }) } },
  },
};
