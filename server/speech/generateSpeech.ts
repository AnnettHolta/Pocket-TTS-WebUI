import { readFile } from "node:fs/promises";
import type { InferenceSession } from "onnxruntime-node";
import {
  createPocketTtsEngine,
  WebGpuInferenceError,
  type RunSynthesisInput,
} from "../../src/workers/pocketTtsCore.ts";
import { ensureLanguageModelDownloaded, getVerifiedModelFile } from "../hf.ts";
import { decodeReferenceAudio } from "./referenceAudio.ts";

function prepareNativeFeeds(feeds: InferenceSession.FeedsType): InferenceSession.FeedsType {
  return Object.fromEntries(Object.entries(feeds).map(([name, tensor]) => {
    if (tensor.type !== "float16" || tensor.location !== "cpu") return [name, tensor];

    const data = tensor.data;
    if (!ArrayBuffer.isView(data) || data instanceof Uint16Array) return [name, tensor];

    // In ORT Node 1.31.1 the binding sees zero bytes for Node's Float16Array.
    // A Uint16Array view supplies the same FP16 bits without copying them.
    const bits = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / Uint16Array.BYTES_PER_ELEMENT);
    return [name, new Proxy(tensor, {
      get(target, key) {
        return key === "data" ? bits : Reflect.get(target, key, target);
      },
    })];
  }));
}

async function createRunner() {
  const ort = await import("onnxruntime-node");
  const engine = createPocketTtsEngine({
    Tensor: ort.Tensor,
    prepareFeeds: prepareNativeFeeds,
    releaseFailedWebGpuSessions: true,
    async modelFiles(languageId) {
      return async (name) => {
        const model = await getVerifiedModelFile(languageId, name);
        if (!model) throw new Error(`Model file unavailable: ${languageId}/${name}`);
        const bytes = await readFile(model.filePath);
        if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) return bytes.buffer;
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      };
    },
    createSession: (buffer, provider) => ort.InferenceSession.create(buffer, {
      executionProviders: [provider],
    }),
  });
  const hasWebGpu = ort.listSupportedBackends().some(({ name, bundled }) => name === "webgpu" && bundled);
  return { engine, hasWebGpu };
}

let runner: ReturnType<typeof createRunner> | undefined;
let busy = false;

export class GenerationBusyError extends Error {}
export class GenerationBackendError extends Error {}

interface GenerateSpeechInput {
  text: string;
  languageId: string;
  precision: RunSynthesisInput["precision"];
  temperature: number;
  backend: "auto" | "webgpu" | "cpu";
  reference?: File;
}

export async function generateSpeech(input: GenerateSpeechInput, signal: AbortSignal) {
  if (busy) throw new GenerationBusyError("A speech generation is already running. Try again shortly.");
  busy = true;
  try {
    const { engine, hasWebGpu } = await (runner ??= createRunner());
    if (input.backend === "webgpu" && !hasWebGpu) {
      throw new GenerationBackendError("WebGPU is unavailable on this server.");
    }

    signal.throwIfAborted();
    const refAudio24k = input.reference && await decodeReferenceAudio(input.reference);
    signal.throwIfAborted();
    await ensureLanguageModelDownloaded(input.languageId, input.precision, Boolean(refAudio24k));

    const synthesis: RunSynthesisInput = {
      text: input.text,
      languageId: input.languageId,
      precision: input.precision,
      temperature: input.temperature,
      refAudio24k,
      onProgress: () => signal.throwIfAborted(),
    };

    if (input.backend === "cpu" || !hasWebGpu) return await engine(synthesis, "cpu");
    try {
      return await engine(synthesis, "webgpu");
    } catch (error) {
      if (!(error instanceof WebGpuInferenceError)) throw error;
      signal.throwIfAborted();
      if (input.backend === "webgpu") {
        throw new GenerationBackendError("WebGPU generation failed on this server.", { cause: error });
      }
      console.warn("[speech] WebGPU generation failed. Retrying on CPU.", error);
      return await engine(synthesis, "cpu");
    }
  } finally {
    busy = false;
  }
}
