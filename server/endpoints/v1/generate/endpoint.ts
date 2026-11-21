import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import {
  generateSpeech,
  GenerationBackendError,
  GenerationBusyError,
} from "../../../speech/generateSpeech.ts";
import { InvalidReferenceError, MAX_REFERENCE_BYTES } from "../../../speech/referenceAudio.ts";
import { generateForm, generateRequest } from "./request.ts";
import { generateResponses } from "./response.ts";

const checkRequest = createMiddleware(async (c, next) => {
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) {
    return c.json({ error: "Cross-origin generation requests are not allowed." }, 403);
  }
  const mediaType = c.req.header("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json" && mediaType !== "multipart/form-data") {
    return c.json({ error: "Send JSON or multipart form data." }, 415);
  }
  await next();
});

const route = createRoute({
  method: "post",
  path: "/api/v1/generate",
  operationId: "generateSpeech",
  summary: "Generate a WAV clip with PocketTTS",
  request: {
    body: {
      description: "Send JSON for the default voice, or multipart form data with a reference audio file.",
      content: {
        "application/json": { schema: generateRequest },
        "multipart/form-data": { schema: generateForm },
      },
    },
  },
  middleware: [
    checkRequest,
    bodyLimit({
      maxSize: MAX_REFERENCE_BYTES + 64 * 1024,
      onError: (c) => c.json({ error: "Request body too large." }, 413),
    }),
  ] as const,
  responses: generateResponses,
});

export function registerGenerateEndpoint(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const form = c.req.valid("form");
    const reference = "reference" in form ? form.reference : undefined;
    const { language, ...fields } = { ...c.req.valid("json"), ...form };

    try {
      const result = await generateSpeech({ ...fields, languageId: language, reference }, c.req.raw.signal);
      return c.body(result.wavBuffer, 200, {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'attachment; filename="speech.wav"',
        "Cache-Control": "no-store",
        "X-Inference-Backend": result.provider,
      });
    } catch (error) {
      if (error instanceof InvalidReferenceError) return c.json({ error: error.message }, 400);
      if (error instanceof GenerationBusyError) {
        c.header("Retry-After", "2");
        return c.json({ error: error.message }, 429);
      }
      if (error instanceof GenerationBackendError) {
        if (error.cause) console.warn("[speech]", error);
        return c.json({ error: error.message }, 503);
      }
      throw error;
    }
  });
}
