import { z } from "@hono/zod-openapi";
import { DEFAULT_MODEL_LANGUAGE, MODEL_FILES } from "../../../modelSource.ts";
import { MAX_REFERENCE_BYTES, MAX_REFERENCE_SECONDS } from "../../../speech/referenceAudio.ts";

const languages = [...new Set(Object.keys(MODEL_FILES).map((file) => file.split("/")[0]))];
const temperature = z.number().min(0).max(1).default(0.3);

export const generateRequest = z.object({
  text: z.string().trim().min(1).max(2_000),
  language: z.enum(languages).default(DEFAULT_MODEL_LANGUAGE),
  precision: z.enum(["int8", "mixed"]).default("int8"),
  temperature,
  backend: z.enum(["auto", "webgpu", "cpu"]).default("auto"),
}).strict();

export const generateForm = generateRequest.extend({
  temperature: z.preprocess(
    (value) => typeof value === "string" && value.trim() !== "" ? Number(value) : value,
    temperature,
  ).openapi({ type: "number", minimum: 0, maximum: 1, default: 0.3 }),
  reference: z.file().min(1).max(MAX_REFERENCE_BYTES).optional().openapi({
    type: "string",
    format: "binary",
    description: `Ogg reference audio (including Opus), up to ${MAX_REFERENCE_SECONDS} seconds and 8 MiB.`,
  }),
});
