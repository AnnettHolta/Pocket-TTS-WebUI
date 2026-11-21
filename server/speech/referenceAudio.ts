import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

export const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
export const MAX_REFERENCE_SECONDS = 20;
const SAMPLE_RATE = 24_000;
const require = createRequire(import.meta.url);

interface FFmpegCore {
  FS: {
    writeFile(name: string, data: Uint8Array): void;
    readFile(name: string): Uint8Array;
  };
  exec(...args: string[]): number;
  setTimeout(ms: number): void;
}

export class InvalidReferenceError extends Error {}

async function createDecoder(): Promise<FFmpegCore> {
  const createCore = require("@ffmpeg/core") as (options: {
    wasmBinary: Uint8Array;
  }) => Promise<FFmpegCore>;
  const wasmBinary = await readFile(require.resolve("@ffmpeg/core/wasm"));
  const globals = globalThis as { self?: unknown };
  if (globals.self !== undefined) return createCore({ wasmBinary });

  // The bundled FFmpeg factory reads self.location synchronously on startup.
  globals.self = { location: { href: import.meta.url } };
  try {
    return createCore({ wasmBinary });
  } finally {
    delete globals.self;
  }
}

export async function decodeReferenceAudio(reference: File): Promise<Float32Array> {
  const core = await createDecoder();
  core.FS.writeFile("reference.audio", new Uint8Array(await reference.arrayBuffer()));
  core.setTimeout(5_000);
  const status = core.exec(
    "-protocol_whitelist", "file", "-f", "ogg", "-i", "reference.audio",
    "-map", "0:a:0", "-t", String(MAX_REFERENCE_SECONDS + 1),
    "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "reference.pcm",
  );
  if (status !== 0) throw new InvalidReferenceError("Provide a playable Ogg audio file.");

  const pcm = core.FS.readFile("reference.pcm");
  if (pcm.byteLength === 0) throw new InvalidReferenceError("The reference audio is empty.");
  if (pcm.byteLength > MAX_REFERENCE_SECONDS * SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT) {
    throw new InvalidReferenceError(`Reference audio must be at most ${MAX_REFERENCE_SECONDS} seconds.`);
  }
  return new Float32Array(pcm.slice().buffer);
}
