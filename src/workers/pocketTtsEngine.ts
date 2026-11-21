import * as ort from "onnxruntime-web/webgpu";
import { modelBasePath, MODEL_RESOLVE_BASE } from "../../server/modelSource";
import { createPocketTtsEngine, type RunSynthesisInput } from "./pocketTtsCore";

export { WebGpuInferenceError } from "./pocketTtsCore";

let ortInitialized = false;

function ensureOrtEnv(): void {
  if (ortInitialized) return;
  ortInitialized = true;
  ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";
  if (!self.crossOriginIsolated) {
    ort.env.wasm.numThreads = 1;
  }
}

async function resolveModelBaseUrl(languageId: string): Promise<string> {
  const localBase = modelBasePath(languageId);
  try {
    const res = await fetch(`${localBase}/bundle.json`);
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.includes("json")) {
      return localBase;
    }
  } catch {
    // Fall back to Hugging Face CDN when local Hono cache is absent.
  }
  return `${MODEL_RESOLVE_BASE}/${languageId}`;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status} ${res.statusText})`);
  }
  return res.arrayBuffer();
}

const engine = createPocketTtsEngine({
  Tensor: ort.Tensor,
  async modelFiles(languageId) {
    ensureOrtEnv();
    const baseUrl = await resolveModelBaseUrl(languageId);
    return (file) => fetchBuffer(`${baseUrl}/${file}`);
  },
  createSession: (buffer, provider) => ort.InferenceSession.create(buffer, {
    executionProviders: [provider],
  }),
});

export function runPocketTtsSynthesis(input: RunSynthesisInput & { forceCpu?: boolean }) {
  const provider = !input.forceCpu && navigator.gpu ? "webgpu" : "wasm";
  return engine(input, provider);
}
