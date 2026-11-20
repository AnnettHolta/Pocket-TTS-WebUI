import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type PrecisionMode = "mixed" | "int8";

export interface ResolvedLanguage {
  id: string;
  label: string;
  defaultTemperature: number;
  cached: boolean;
}

const HF_REPO = "stephvax/pocket-tts-onnx";
const HF_TREE_URL = `https://huggingface.co/api/models/${HF_REPO}/tree/main/onnx`;
const HF_RESOLVE_BASE = `https://huggingface.co/${HF_REPO}/resolve/main/onnx`;

export const MODELS_PUBLIC_DIR = path.resolve(
  process.cwd(),
  "public",
  "models",
  "pocket-tts"
);

const FALLBACK_LANGUAGES: Omit<ResolvedLanguage, "cached">[] = [
  { id: "english_2026-10", label: "English (2026-10)", defaultTemperature: 0.3 },
  { id: "french_24l", label: "French (24L)", defaultTemperature: 0.3 },
  { id: "german_24l", label: "German (24L)", defaultTemperature: 0.3 },
  { id: "italian_24l", label: "Italian (24L)", defaultTemperature: 0.3 },
  { id: "portuguese_24l", label: "Portuguese (24L)", defaultTemperature: 0.3 },
  { id: "spanish_24l", label: "Spanish (24L)", defaultTemperature: 0.3 },
];

let resolvedLanguages: Omit<ResolvedLanguage, "cached">[] = FALLBACK_LANGUAGES;
const inflightDownloads = new Map<string, Promise<"downloaded" | "skipped">>();

function formatLanguageLabel(id: string): string {
  const [rawLang, rawVariant] = id.split("_", 2);
  const lang = rawLang ? rawLang.charAt(0).toUpperCase() + rawLang.slice(1) : id;
  if (!rawVariant) return lang;
  const variant = rawVariant.toUpperCase() === rawVariant ? rawVariant : rawVariant.replace(/l$/i, "L");
  return `${lang} (${variant})`;
}

async function fileExistsNonEmpty(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
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
  const dir = path.join(MODELS_PUBLIC_DIR, languageId);
  const required = getRequiredFiles(precision, false);
  const checks = await Promise.all(
    required.map((file) => fileExistsNonEmpty(path.join(dir, file)))
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
      .map((e) => e.path.replace(/^onnx\//, ""));

    if (dirs.length === 0) return;

    const loaded = await Promise.all(
      dirs.map(async (id) => {
        let defaultTemperature = 0.3;
        try {
          const bRes = await fetch(`${HF_RESOLVE_BASE}/${id}/bundle.json`, { signal });
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

    resolvedLanguages = loaded;
    console.log(
      `[hono] Resolved ${resolvedLanguages.length} languages from ${HF_REPO}:`,
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
  if (await fileExistsNonEmpty(destPath)) {
    return "skipped";
  }

  const url = `${HF_RESOLVE_BASE}/${languageId}/${fileName}`;
  const res = await fetch(url).catch((cause: unknown) => {
    throw new Error(`Could not reach Hugging Face to download ${languageId}/${fileName}`, { cause });
  });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url} (${res.status} ${res.statusText})`);
  }

  const partPath = `${destPath}.${randomUUID()}.part`;
  try {
    const nodeStream = Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream);
    await pipeline(nodeStream, createWriteStream(partPath));
    if (!(await fileExistsNonEmpty(partPath))) {
      throw new Error(`Hugging Face returned an empty file for ${languageId}/${fileName}`);
    }
    await rename(partPath, destPath);
  } finally {
    await rm(partPath, { force: true });
  }
  return "downloaded";
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

  const destDir = path.join(MODELS_PUBLIC_DIR, languageId);
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
