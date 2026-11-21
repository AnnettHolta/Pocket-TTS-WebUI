import { z } from "@hono/zod-openapi";

export const modelFileParams = z.object({
  revision: z.string(),
  lang: z.string(),
  file: z.string(),
});

export const modelFilePath = z.object({
  lang: z.string().regex(/^[\w-]+$/),
  file: z.string().regex(/^[\w-][\w.-]*$/),
});
