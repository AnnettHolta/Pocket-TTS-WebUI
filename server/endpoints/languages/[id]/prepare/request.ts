import { z } from "@hono/zod-openapi";

export const prepareLanguageParams = z.object({ id: z.string() });

export const prepareLanguageBody = z.object({
  precision: z.enum(["int8", "mixed"]).optional(),
  includeEncoder: z.boolean().optional(),
});
