import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream, type Stats } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DEFAULT_MODEL_LANGUAGE, MODEL_FILES, MODEL_REPO, MODEL_RESOLVE_BASE, MODEL_REVISION, type ModelFile } from "./modelSource.ts";

export type PrecisionMode = "mixed" | "int8";

export interface ResolvedLanguage {
  id: string;
  label: string;
  defaultTemperature: number;
  cached: boolean;
}

const HF_TREE_URL = `https://huggingface.co/api/models/${MODEL_REPO}/tree/${MODEL_REVISION}/onnx`;

const MODELS_PUBLIC_DIR = path.resolve(
  process.cwd(),
  "public",
  "models",
  "pocket-tts"
);
const REVISION_DIR = path.join(MODELS_PUBLIC_DIR, MODEL_REVISION);

const FALLBACK_LANGUAGES: Omit<ResolvedLanguage, "cached">[] = [
  { id: DEFAULT_MODEL_LANGUAGE, label: "English (2026-10)", defaultTemperature: 0.3 },
  { id: "french_24l", label: "French (24L)", defaultTemperature: 0.3 },
  { id: "german_24l", label: "German (24L)", defaultTemperature: 0.3 },
  { id: "italian_24l", label: "Italian (24L)", defaultTemperature: 0.3 },
  { id: "portuguese_24l", label: "Portuguese (24L)", defaultTemperature: 0.3 },
  { id: "spanish_24l", label: "Spanish (24L)", defaultTemperature: 0.3 },
];

let resolvedLanguages: Omit<ResolvedLanguage, "cached">[] = FALLBACK_LANGUAGES;
const inflightDownloads = new Map<string, Promise<"downloaded" | "skipped">>();
const verifiedFiles = new Map<string, string>();

function formatLanguageLabel(id: string): string {
  const [rawLang, rawVariant] = id.split("_", 2);
  const lang = rawLang ? rawLang.charAt(0).toUpperCase() + rawLang.slice(1) : id;
  if (!rawVariant) return lang;
  const variant = rawVariant.toUpperCase() === rawVariant ? rawVariant : rawVariant.replace(/l$/i, "L");
  return `${lang} (${variant})`;
}

async function matchingSize(filePath: string, expected: ModelFile): Promise<Stats | null> {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size === expected.size ? info : null;
  } catch {
    return null;
  }
}

async function matchesSidecar(filePath: string, expected: ModelFile): Promise<boolean> {
  try {
    const meta = JSON.parse(await readFile(`${filePath}.meta`, "utf8"));
    return meta?.revision === MODEL_REVISION && meta.size === expected.size && meta.sha256 === expected.sha256;
  } catch {
    return false;
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function fingerprint(info: Stats): string {
  return `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
}

async function verifiedStat(filePath: string, expected: ModelFile): Promise<Stats | null> {
  const info = await matchingSize(filePath, expected);
  if (!info) return null;
  const stamp = fingerprint(info);
  if (verifiedFiles.get(filePath) === stamp) return info;
  try {
    if (await hashFile(filePath) !== expected.sha256) return null;
    const after = await matchingSize(filePath, expected);
    if (!after || fingerprint(after) !== stamp) return null;
    verifiedFiles.set(filePath, stamp);
    return after;
  } catch {
    return null;
  }
}

export async function getVerifiedModelFile(languageId: string, fileName: string) {
  const expected = MODEL_FILES[`${languageId}/${fileName}`];
  if (!expected) return null;
  const filePath = path.join(REVISION_DIR, languageId, fileName);
  if (!await matchesSidecar(filePath, expected)) return null;
  const info = await verifiedStat(filePath, expected);
  return info ? { filePath, size: info.size } : null;
}

export function getRequiredFiles(
  precision: PrecisionMode,
  includeEncoder: boolean
): string[] {
  const flowFile =
    precision === "int8" ? "flow_lm_flow_int8.onnx" : "flow_lm_flow.onnx";
  const decoderFile =
    precision === "int8" ? "mimi_decoder_int8.onnx" : "mimi_decoder.onnx";

  const files = [
    "bundle.json",
    "tokenizer.model",
    "bos_before_voice.npy",
    "text_conditioner.onnx",
    "flow_lm_main_int8.onnx",
    flowFile,
    decoderFile,
  ];
  if (includeEncoder) {
    files.push("mimi_encoder.onnx");
  }
  return files;
}

export async function isLanguageCached(
  languageId: string,
  precision: PrecisionMode = "mixed"
): Promise<boolean> {
  const dir = path.join(REVISION_DIR, languageId);
  const required = getRequiredFiles(precision, false);
  const checks = await Promise.all(
    required.map(async (file) => {
      const expected = MODEL_FILES[`${languageId}/${file}`];
      const filePath = path.join(dir, file);
      return expected && await matchingSize(filePath, expected) && await matchesSidecar(filePath, expected);
    })
  );
  return checks.every(Boolean);
}

export async function resolveLanguagesOnStartup(): Promise<void> {
  try {
    const signal = AbortSignal.timeout(10_000);
    const res = await fetch(HF_TREE_URL, { signal });
    if (!res.ok) {
      throw new Error(`HF tree API returned ${res.status}`);
    }
    const entries = (await res.json()) as Array<{ type: string; path: string }>;
    const dirs = entries
      .filter((e) => e.type === "directory" && e.path.startsWith("onnx/"))
      .map((e) => e.path.replace(/^onnx\//, ""))
      .filter((id) => MODEL_FILES[`${id}/bundle.json`]);

    if (dirs.length === 0) return;

    const loaded = await Promise.all(
      dirs.map(async (id) => {
        let defaultTemperature = 0.3;
        try {
          const bRes = await fetch(`${MODEL_RESOLVE_BASE}/${id}/bundle.json`, { signal });
          if (bRes.ok) {
            const bundle = (await bRes.json()) as { default_temperature?: number | null };
            if (typeof bundle.default_temperature === "number") {
              defaultTemperature = bundle.default_temperature;
            }
          }
        } catch {
          // Keep default temperature fallback.
        }
        return {
          id,
          label: formatLanguageLabel(id),
          defaultTemperature,
        };
      })
    );

    resolvedLanguages = loaded.sort((a, b) =>
      Number(b.id === DEFAULT_MODEL_LANGUAGE) - Number(a.id === DEFAULT_MODEL_LANGUAGE) || a.id.localeCompare(b.id)
    );
    console.log(
      `[hono] Resolved ${resolvedLanguages.length} languages from ${MODEL_REPO}:`,
      resolvedLanguages.map((l) => l.id).join(", ")
    );
  } catch (err) {
    console.warn(
      "[hono] Failed to resolve languages from Hugging Face on startup; using fallback list:",
      err instanceof Error ? err.message : err
    );
  }
}

export async function listLanguages(): Promise<ResolvedLanguage[]> {
  return Promise.all(
    resolvedLanguages.map(async (lang) => ({
      ...lang,
      cached: await isLanguageCached(lang.id),
    }))
  );
}

async function downloadFileIfMissing(
  languageId: string,
  fileName: string,
  destDir: string
): Promise<"downloaded" | "skipped"> {
  const destPath = path.join(destDir, fileName);
  const existing = inflightDownloads.get(destPath);
  if (existing) {
    await existing;
    return "skipped";
  }

  const download = cacheModelFile(languageId, fileName, destPath);
  inflightDownloads.set(destPath, download);
  try {
    return await download;
  } finally {
    inflightDownloads.delete(destPath);
  }
}

async function cacheModelFile(
  languageId: string,
  fileName: string,
  destPath: string
): Promise<"downloaded" | "skipped"> {
  const expected = MODEL_FILES[`${languageId}/${fileName}`];
  if (!expected) throw new Error(`Missing manifest entry for ${languageId}/${fileName}`);
  const metadata = JSON.stringify({ revision: MODEL_REVISION, ...expected });
  const suffix = `.${randomUUID()}.part`;
  const partPath = destPath + suffix;
  const partMeta = `${destPath}.meta${suffix}`;

  if (await verifiedStat(destPath, expected)) {
    if (!await matchesSidecar(destPath, expected)) {
      try {
        await writeFile(partMeta, metadata);
        await rename(partMeta, `${destPath}.meta`);
      } finally {
        await rm(partMeta, { force: true });
      }
    }
    return "skipped";
  }
  try {
    const legacy = path.join(MODELS_PUBLIC_DIR, languageId, fileName);
    const reused = Boolean(await verifiedStat(legacy, expected));
    if (reused) {
      await copyFile(legacy, partPath);
    } else {
      const url = `${MODEL_RESOLVE_BASE}/${languageId}/${fileName}`;
      const res = await fetch(url).catch((cause: unknown) => {
        throw new Error(`Could not reach Hugging Face to download ${languageId}/${fileName}`, { cause });
      });
      if (!res.ok || !res.body) {
        throw new Error(`Failed to download ${url} (${res.status} ${res.statusText})`);
      }
      const nodeStream = Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream);
      await pipeline(nodeStream, createWriteStream(partPath));
    }
    if (!await matchingSize(partPath, expected) || await hashFile(partPath) !== expected.sha256) {
      throw new Error(`Model checksum mismatch for ${languageId}/${fileName}`);
    }
    await writeFile(partMeta, metadata);
    await rename(partPath, destPath);
    await rename(partMeta, `${destPath}.meta`);
    verifiedFiles.set(destPath, fingerprint(await stat(destPath)));
    return reused ? "skipped" : "downloaded";
  } finally {
    await rm(partPath, { force: true });
    await rm(partMeta, { force: true });
  }
}

export async function ensureLanguageModelDownloaded(
  languageId: string,
  precision: PrecisionMode = "mixed",
  includeEncoder = false
): Promise<{ downloaded: string[]; skipped: string[] }> {
  const known = resolvedLanguages.some((l) => l.id === languageId);
  if (!known) {
    throw new Error(`Unknown language model: ${languageId}`);
  }

  const destDir = path.join(REVISION_DIR, languageId);
  await mkdir(destDir, { recursive: true });

  const downloaded: string[] = [];
  const skipped: string[] = [];
  for (const file of getRequiredFiles(precision, includeEncoder)) {
    const result = await downloadFileIfMissing(languageId, file, destDir);
    if (result === "downloaded") {
      downloaded.push(file);
      console.log(`[hono] Cached ${languageId}/${file}`);
    } else {
      skipped.push(file);
    }
  }
  return { downloaded, skipped };
}
