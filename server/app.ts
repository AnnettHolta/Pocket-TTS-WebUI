import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { Hono } from "hono";
import {
  ensureLanguageModelDownloaded,
  listLanguages,
  MODELS_PUBLIC_DIR,
  type PrecisionMode,
} from "./hf.ts";

export const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/languages", async (c) => {
  const languages = await listLanguages();
  return c.json({ languages });
});

app.post("/api/languages/:id/prepare", async (c) => {
  const languageId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    precision?: PrecisionMode;
    includeEncoder?: boolean;
  };
  const precision: PrecisionMode = body.precision === "int8" ? "int8" : "mixed";
  const includeEncoder = Boolean(body.includeEncoder);

  try {
    const result = await ensureLanguageModelDownloaded(
      languageId,
      precision,
      includeEncoder
    );
    return c.json({
      ok: true,
      baseUrl: `/models/pocket-tts/${languageId}`,
      ...result,
    });
  } catch (err) {
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      400
    );
  }
});

// Serve locally cached models from public/models/pocket-tts/*
app.get("/models/pocket-tts/:lang/:file", async (c) => {
  const lang = c.req.param("lang");
  const file = c.req.param("file");
  if (!/^[\w-]+$/.test(lang) || !/^[\w.-]+$/.test(file) || file.startsWith(".")) {
    return c.text("Forbidden", 403);
  }

  const filePath = path.join(MODELS_PUBLIC_DIR, lang, file);
  const info = await stat(filePath).catch(() => null);
  if (file.endsWith(".part") || !info?.isFile() || info.size === 0) {
    return c.text("Not found", 404);
  }

  const data = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  const contentType = file.endsWith(".json")
    ? "application/json; charset=utf-8"
    : "application/octet-stream";

  return c.body(data, 200, {
    "Content-Type": contentType,
    "Content-Length": String(info.size),
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});


