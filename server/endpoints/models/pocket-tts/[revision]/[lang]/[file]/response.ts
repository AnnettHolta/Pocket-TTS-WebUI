import { z } from "@hono/zod-openapi";

export const modelFileResponses = {
  200: {
    description: "Verified model artifact.",
    content: {
      "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) },
      "application/json": { schema: z.object({}).passthrough() },
    },
  },
  403: {
    description: "Invalid language or file name.",
    content: { "text/plain": { schema: z.string() } },
  },
  404: {
    description: "Revision or cached file unavailable.",
    content: { "text/plain": { schema: z.string() } },
  },
};
