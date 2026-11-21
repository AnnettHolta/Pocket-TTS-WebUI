import { z } from "@hono/zod-openapi";

export const listLanguagesResponses = {
  200: {
    description: "Available language models.",
    content: {
      "application/json": {
        schema: z.object({
          languages: z.array(z.object({
            id: z.string(),
            label: z.string(),
            defaultTemperature: z.number(),
            cached: z.boolean(),
          })),
        }),
      },
    },
  },
};
