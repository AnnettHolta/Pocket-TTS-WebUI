// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revision, language, contents, files } = vi.hoisted(() => ({
  revision: "pinned-revision",
  language: "english_2026-10",
  contents: "model contents",
  files: ["bundle.json", "tokenizer.model", "bos_before_voice.npy", "text_conditioner.onnx",
    "flow_lm_main_int8.onnx", "flow_lm_flow.onnx", "mimi_decoder.onnx"],
}));

vi.mock("./modelSource.ts", async () => {
  const { createHash } = await import("node:crypto");
  const file = { size: contents.length, sha256: createHash("sha256").update(contents).digest("hex") };
  return {
    MODEL_REPO: "test/model",
    MODEL_REVISION: revision,
    DEFAULT_MODEL_LANGUAGE: language,
    MODEL_RESOLVE_BASE: `https://models.example/${revision}/onnx`,
    MODEL_FILES: Object.fromEntries(files.map((name) => [`${language}/${name}`, file])),
    modelBasePath: (id: string) => `/models/pocket-tts/${revision}/${id}`,
  };
});

describe("pinned model cache", () => {
  let root: string;
  let cacheDir: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "pocket-tts-cache-"));
    cacheDir = path.join(root, "public", "models", "pocket-tts", revision, language);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (path.dirname(path.resolve(root)) === path.resolve(tmpdir())) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function loadCache() {
    const cwd = vi.spyOn(process, "cwd").mockImplementation(() => root);
    try {
      return await import("./hf.ts");
    } finally {
      cwd.mockRestore();
    }
  }

  it("reuses a pinned download and repairs a same-size corrupt file", async () => {
    const fetch = vi.fn(async () => new Response(contents));
    vi.stubGlobal("fetch", fetch);
    const cache = await loadCache();

    await expect(cache.ensureLanguageModelDownloaded(language)).resolves.toMatchObject({ downloaded: files });
    expect(fetch).toHaveBeenCalledTimes(files.length);
    expect(fetch).toHaveBeenCalledWith(`https://models.example/${revision}/onnx/${language}/${files[0]}`);
    const target = path.join(cacheDir, files[0]);
    expect(JSON.parse(await readFile(`${target}.meta`, "utf8"))).toEqual({
      revision, size: contents.length, sha256: createHash("sha256").update(contents).digest("hex"),
    });
    await expect(cache.ensureLanguageModelDownloaded(language)).resolves.toMatchObject({ downloaded: [], skipped: files });
    expect(fetch).toHaveBeenCalledTimes(files.length);

    await writeFile(target, "!".repeat(contents.length));
    await expect(cache.getVerifiedModelFile(language, files[0])).resolves.toBeNull();
    await expect(cache.ensureLanguageModelDownloaded(language)).resolves.toMatchObject({ downloaded: [files[0]] });
    expect(await readFile(target, "utf8")).toBe(contents);
    expect(fetch).toHaveBeenCalledTimes(files.length + 1);
  });

  it("rejects a bad response before it becomes a cache entry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("!".repeat(contents.length))));
    const cache = await loadCache();

    await expect(cache.ensureLanguageModelDownloaded(language)).rejects.toThrow("Model checksum mismatch");
    expect(await readdir(cacheDir)).toEqual([]);
  });
});
