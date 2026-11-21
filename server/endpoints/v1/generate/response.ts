import { z } from "@hono/zod-openapi";

const error = (description: string) => ({
  description,
  content: { "application/json": { schema: z.object({ error: z.string() }) } },
});

export const generateResponses = {
  200: {
    description: "Generated PCM WAV audio.",
    headers: {
      "X-Inference-Backend": {
        description: "ONNX Runtime execution provider selected for generation.",
        schema: { type: "string" as const, enum: ["webgpu", "cpu"] },
      },
    },
    content: { "audio/wav": { schema: z.string().openapi({ format: "binary" }) } },
  },
  400: error("Invalid request fields, malformed body, or unusable reference audio."),
  403: error("Cross-origin browser request."),
  413: error("Request body too large."),
  415: error("Unsupported request content type."),
  429: error("A generation is already running."),
  500: error("Generation failed."),
  503: error("Requested inference backend is unavailable."),
};
