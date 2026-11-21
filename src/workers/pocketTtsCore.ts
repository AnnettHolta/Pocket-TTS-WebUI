import type * as ort from "onnxruntime-web";
import type { PrecisionMode } from "../lib/historyDb";
import type { SpeechPart, SpeechStage, TtsProvider } from "./ttsTypes";
import {
  encodeWav,
  parseNpyFloat32,
  SentencePieceTokenizer,
  splitSpeechText,
  type SpeechChunk,
} from "./pocketTtsHelpers.ts";

export interface BundleConfig {
  schema_version: number;
  language: string;
  bos_before_voice_file: string;
  tokenizer_file: string;
  insert_bos_before_voice: boolean;
  conditioning_dim: number;
  latent_dim: number;
  frame_rate: number;
  sample_rate: number;
  samples_per_frame: number;
  max_token_per_chunk: number;
  default_temperature: number | null;
  replace_characters?: Record<string, string>;
}

interface TensorMeta {
  name: string;
  type?: string;
  shape?: ReadonlyArray<number | string>;
}

interface LoadedModelPack {
  key: string;
  provider: InferenceProvider;
  bundle: BundleConfig;
  tokenizer: SentencePieceTokenizer;
  bosBeforeVoice: Float32Array;
  textConditioner: ort.InferenceSession;
  flowLmMain: ort.InferenceSession;
  flowLmFlow: ort.InferenceSession;
  mimiDecoder: ort.InferenceSession;
  mimiEncoder: ort.InferenceSession | null;
}

type InferenceProvider = TtsProvider | "cpu";

interface Runtime {
  Tensor: typeof ort.Tensor;
  modelFiles(languageId: string): Promise<(name: string) => Promise<ArrayBuffer>>;
  createSession(buffer: ArrayBuffer, provider: InferenceProvider): Promise<ort.InferenceSession>;
  prepareFeeds?(feeds: ort.InferenceSession.FeedsType): ort.InferenceSession.FeedsType;
  releaseFailedWebGpuSessions?: boolean;
}

interface EngineState {
  runtime: Runtime;
  cachedPack: LoadedModelPack | null;
}

export class WebGpuInferenceError extends Error {
  constructor(cause: unknown) {
    super("WebGPU inference failed.", { cause });
    this.name = "WebGpuInferenceError";
  }
}

async function runOrt<T>(provider: InferenceProvider, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (provider === "webgpu") throw new WebGpuInferenceError(error);
    throw error;
  }
}

function runSession(
  runtime: Runtime,
  provider: InferenceProvider,
  session: ort.InferenceSession,
  feeds: ort.InferenceSession.FeedsType,
) {
  return runOrt(provider, () => session.run(runtime.prepareFeeds?.(feeds) ?? feeds));
}

async function releaseSessions(sessions: ort.InferenceSession[]) {
  for (const session of sessions) {
    try {
      await session.release();
    } catch (error) {
      console.warn("Could not release a speech model session:", error);
    }
  }
}

async function releaseModelPack(state: EngineState, pack: LoadedModelPack) {
  state.cachedPack = null;
  await releaseSessions([
    pack.textConditioner, pack.flowLmMain, pack.flowLmFlow, pack.mimiDecoder,
    ...(pack.mimiEncoder ? [pack.mimiEncoder] : []),
  ]);
}

function getInputMetas(session: ort.InferenceSession): TensorMeta[] {
  const raw = (session as unknown as { inputMetadata?: TensorMeta[] }).inputMetadata;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw;
  }
  return session.inputNames.map((name) => ({ name, type: "float32", shape: [1] }));
}

function resolveStateShape(
  rawShape: ReadonlyArray<number | string> | undefined
): number[] {
  if (!rawShape || rawShape.length === 0) return [0];
  return rawShape.map((dim) => {
    if (typeof dim === "number" && dim > 0) return dim;
    return 0;
  });
}

function createZeroTensorFromMeta(Tensor: Runtime["Tensor"], meta: TensorMeta): ort.Tensor {
  const shape = resolveStateShape(meta.shape);
  const size = shape.reduce((acc, d) => acc * d, 1);
  const dtype = meta.type ?? "float32";

  switch (dtype) {
    case "bool":
      return new Tensor("bool", new Uint8Array(size), shape);
    case "float16":
      return new Tensor("float16", new Uint16Array(size), shape);
    case "int64":
      return new Tensor("int64", new BigInt64Array(size), shape);
    case "int32":
      return new Tensor("int32", new Int32Array(size), shape);
    case "uint8":
      return new Tensor("uint8", new Uint8Array(size), shape);
    case "int8":
      return new Tensor("int8", new Int8Array(size), shape);
    default:
      return new Tensor("float32", new Float32Array(size), shape);
  }
}

function sampleStandardNormal(length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 2) {
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const mag = Math.sqrt(-2 * Math.log(u1));
    out[i] = mag * Math.cos(2 * Math.PI * u2);
    if (i + 1 < length) {
      out[i + 1] = mag * Math.sin(2 * Math.PI * u2);
    }
  }
  return out;
}

function mapStateOutputsToInputs(
  inputNames: readonly string[],
  outputNames: readonly string[],
  outputs: ort.InferenceSession.OnnxValueMapType,
  stateFeeds: Record<string, ort.Tensor>
): void {
  // Match state outputs (e.g. out_state_0 / present_k_0) back to state inputs.
  for (let i = 0; i < outputNames.length; i++) {
    const outName = outputNames[i];
    const tensor = outputs[outName];
    if (!tensor) continue;

    if (outName in stateFeeds) {
      stateFeeds[outName] = tensor;
      continue;
    }

    const normalized = outName
      .replace(/^out_/, "")
      .replace(/^present/, "past")
      .replace(/_out$/, "");
    if (normalized in stateFeeds) {
      stateFeeds[normalized] = tensor;
      continue;
    }

    // Positional fallback for matching state_* / cache_* names
    const suffixMatch = outName.match(/(\d+)$/);
    if (suffixMatch) {
      const idx = suffixMatch[1];
      const candidate = inputNames.find(
        (n) => n in stateFeeds && n.endsWith(idx) && (n.includes("k") === outName.includes("k"))
      );
      if (candidate) {
        stateFeeds[candidate] = tensor;
      }
    }
  }
}

async function loadModelPack(
  state: EngineState,
  languageId: string,
  precision: PrecisionMode,
  provider: InferenceProvider,
  needsEncoder: boolean,
  onProgress: RunSynthesisInput["onProgress"],
): Promise<LoadedModelPack> {
  const key = `${languageId}:${precision}:${provider}`;
  const { runtime, cachedPack: cached } = state;
  const createSession = (buffer: ArrayBuffer) => runOrt(provider, () => runtime.createSession(buffer, provider));
  const gpu = provider === "webgpu";
  if (cached?.key === key) {
    if (needsEncoder && !cached.mimiEncoder) {
      onProgress("loadingVoiceEncoder", 0.56);
      const loadFile = await runtime.modelFiles(languageId);
      const encoder = await loadFile("mimi_encoder.onnx");
      onProgress("initializingVoiceEncoder", 0.58, gpu);
      cached.mimiEncoder = await createSession(encoder);
    }
    return cached;
  }

  if (cached) {
    onProgress("releasingModel", 0.07, cached.provider === "webgpu");
    await releaseModelPack(state, cached);
  }

  const loadFile = await runtime.modelFiles(languageId);
  onProgress("loadingBundle", 0.08);
  const bundle = JSON.parse(new TextDecoder().decode(await loadFile("bundle.json"))) as BundleConfig;

  const [tokenizerBuf, bosBuf] = await Promise.all([
    loadFile(bundle.tokenizer_file),
    loadFile(bundle.bos_before_voice_file),
  ]);

  const tokenizer = SentencePieceTokenizer.fromModelBuffer(tokenizerBuf);
  const bosBeforeVoice = parseNpyFloat32(bosBuf).data;

  const flowFile =
    precision === "int8" ? "flow_lm_flow_int8.onnx" : "flow_lm_flow.onnx";
  const decoderFile =
    precision === "int8" ? "mimi_decoder_int8.onnx" : "mimi_decoder.onnx";

  onProgress("loadingGraphs", 0.22);
  const [condBuf, mainBuf, flowBuf, decBuf] = await Promise.all([
    loadFile("text_conditioner.onnx"),
    loadFile("flow_lm_main_int8.onnx"),
    loadFile(flowFile),
    loadFile(decoderFile),
  ]);

  const sessions: ort.InferenceSession[] = [];
    const init = async (stage: SpeechStage, progress: number, buffer: ArrayBuffer) => {
    onProgress(stage, progress, gpu);
    const session = await createSession(buffer);
    sessions.push(session);
    return session;
  };
  try {
    // Initialize sessions sequentially for WebGPU.
    const textConditioner = await init("initializingTextConditioner", 0.38, condBuf);
    const flowLmMain = await init("initializingBackbone", 0.44, mainBuf);
    const flowLmFlow = await init("initializingFlow", 0.5, flowBuf);
    const mimiDecoder = await init("initializingDecoder", 0.55, decBuf);
    let mimiEncoder: ort.InferenceSession | null = null;
    if (needsEncoder) {
      onProgress("loadingVoiceEncoder", 0.56);
      const encoder = await loadFile("mimi_encoder.onnx");
      mimiEncoder = await init("initializingVoiceEncoder", 0.58, encoder);
    }

    return state.cachedPack = {
      key, provider, bundle, tokenizer, bosBeforeVoice,
      textConditioner, flowLmMain, flowLmFlow, mimiDecoder, mimiEncoder,
    };
  } catch (error) {
    // The browser worker resets after a GPU failure, so only Node releases these sessions here.
    if (!(error instanceof WebGpuInferenceError) || runtime.releaseFailedWebGpuSessions) {
      await releaseSessions(sessions);
    }
    throw error;
  }
}

export interface RunSynthesisInput {
  text: string;
  languageId: string;
  precision: PrecisionMode;
  temperature: number;
  refAudio24k?: Float32Array;
  onProgress: (stage: SpeechStage, progress: number, webGpuOperation?: boolean, part?: SpeechPart) => void;
}

export function createPocketTtsEngine(runtime: Runtime) {
  const state: EngineState = { runtime, cachedPack: null };
  return async <Provider extends InferenceProvider>(input: RunSynthesisInput, provider: Provider) => {
    try {
      return await runPocketTtsSynthesis(state, input, provider);
    } catch (error) {
      if (error instanceof WebGpuInferenceError && runtime.releaseFailedWebGpuSessions && state.cachedPack) {
        await releaseModelPack(state, state.cachedPack);
      }
      throw error;
    }
  };
}

async function runPocketTtsSynthesis<Provider extends InferenceProvider>(
  state: EngineState,
  input: RunSynthesisInput,
  provider: Provider,
): Promise<{
  wavBuffer: ArrayBuffer;
  durationSec: number;
  provider: Provider;
}> {
  const { Tensor } = state.runtime;
  const gpu = provider === "webgpu";
  const pack = await loadModelPack(
    state,
    input.languageId,
    input.precision,
    provider,
    Boolean(input.refAudio24k),
    input.onProgress
  );

  input.onProgress("tokenizingText", 0.62);
  let normalizedText = input.text.trim();
  if (pack.bundle.replace_characters) {
    for (const [from, to] of Object.entries(pack.bundle.replace_characters)) {
      normalizedText = normalizedText.split(from).join(to);
    }
  }
  const maxTokens = pack.bundle.max_token_per_chunk || 50;
  const chunks = splitSpeechText(normalizedText, maxTokens, (text) => pack.tokenizer.encode(text));
  if (chunks.length === 0) {
    throw new Error("Text produced 0 tokens");
  }

  // Optional reference voice encoding
  let voicePrompt: Float32Array = pack.bosBeforeVoice;
  if (input.refAudio24k && pack.mimiEncoder) {
    input.onProgress("encodingReference", 0.64, gpu);
    const audioTensor = new Tensor("float32", input.refAudio24k, [
      1,
      1,
      input.refAudio24k.length,
    ]);
    const encOut = await runSession(state.runtime, provider, pack.mimiEncoder, {
      [pack.mimiEncoder.inputNames[0]]: audioTensor,
    });
    const encoded = encOut[pack.mimiEncoder.outputNames[0]].data as Float32Array;
    if (pack.bundle.insert_bos_before_voice) {
      const combined = new Float32Array(pack.bosBeforeVoice.length + encoded.length);
      combined.set(pack.bosBeforeVoice, 0);
      combined.set(encoded, pack.bosBeforeVoice.length);
      voicePrompt = combined;
    } else {
      voicePrompt = encoded;
    }
  }

  const pcmChunks: Float32Array[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const onProgress: RunSynthesisInput["onProgress"] = (stage, progress, webGpuOperation) => {
      const chunkProgress = progress - 0.66;
      const part = chunks.length > 1 ? { current: index + 1, total: chunks.length } : undefined;
      input.onProgress(stage, 0.66 + (0.31 * index + chunkProgress) / chunks.length, webGpuOperation, part);
    };
    const pcm = await synthesizeChunk(state.runtime, pack, chunk, voicePrompt, input.temperature, onProgress);
    if (!pcm) {
      const part = chunks.length > 1 ? ` for part ${index + 1} of ${chunks.length}` : "";
      const hint = input.refAudio24k ? "Try a shorter reference voice or rephrase the text." : "Try rephrasing the text.";
      throw new Error(`Speech generation did not finish${part}. ${hint}`);
    }
    pcmChunks.push(...pcm);
  }

  const totalSamples = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pcm = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of pcmChunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }

  input.onProgress("encodingWav", 0.98);
  const sampleRate = pack.bundle.sample_rate || 24000;
  return { wavBuffer: encodeWav(pcm, sampleRate), durationSec: totalSamples / sampleRate, provider };
}

async function synthesizeChunk(
  runtime: Runtime,
  pack: LoadedModelPack,
  chunk: SpeechChunk,
  voicePrompt: Float32Array,
  temperature: number,
  onProgress: RunSynthesisInput["onProgress"],
): Promise<Float32Array[] | null> {
  const { Tensor } = runtime;
  const provider = pack.provider;
  const gpu = provider === "webgpu";
  const tokenIds = chunk.tokens;
  const condDim = pack.bundle.conditioning_dim || 1024;
  onProgress("conditioningText", 0.66, gpu);
  const tokenTensor = new Tensor(
    "int64",
    BigInt64Array.from(tokenIds, (id) => BigInt(id)),
    [1, tokenIds.length]
  );
  const condOut = await runSession(runtime, provider, pack.textConditioner, {
    [pack.textConditioner.inputNames[0]]: tokenTensor,
  });
  const textEmb = condOut[pack.textConditioner.outputNames[0]];

  // Prepare flow_lm_main state tensors from inputMetadata
  const mainMetas = getInputMetas(pack.flowLmMain);
  const mainStateFeeds: Record<string, ort.Tensor> = {};
  let seqInputName = pack.flowLmMain.inputNames[0];
  let textInputName: string | null = null;

  for (const meta of mainMetas) {
    const lower = meta.name.toLowerCase();
    if (lower.includes("sequence") || lower === "x" || lower === "latent") {
      seqInputName = meta.name;
    } else if (lower.includes("text")) {
      textInputName = meta.name;
    } else {
      mainStateFeeds[meta.name] = createZeroTensorFromMeta(Tensor, meta);
    }
  }

  // Conditioning pass: feed text embeddings + voice prompt if separate text input exists
  const latentDim = pack.bundle.latent_dim || 32;
  const emptySeq = new Tensor("float32", new Float32Array(0), [1, 0, latentDim]);
  if (textInputName) {
    const voiceFrames = Math.max(1, Math.floor(voicePrompt.length / condDim));
    const voiceTensor = new Tensor("float32", voicePrompt, [1, voiceFrames, condDim]);
    const condFeeds: Record<string, ort.Tensor> = {
      ...mainStateFeeds,
      [seqInputName]: emptySeq,
      [textInputName]: textTensorOrCombined(Tensor, textEmb, voiceTensor),
    };
    onProgress("preparingVoice", 0.71, gpu);
    const initOut = await runSession(runtime, provider, pack.flowLmMain, condFeeds);
    mapStateOutputsToInputs(
      pack.flowLmMain.inputNames,
      pack.flowLmMain.outputNames,
      initOut,
      mainStateFeeds
    );
  }

  // Autoregressive latent generation (matching PocketTTS.cpp)
  const wordCount = chunk.text.split(/\s+/).length;
  const eosExtraFrames = wordCount <= 4 ? 5 : 3;
  const eosThreshold = -4.0;
  const lsdSteps = 1;
  const dt = 1.0 / lsdSteps;
  const maxFrames = Math.min(200, Math.max(48, tokenIds.length * 8));
  const flowConditioningInput = pack.flowLmFlow.inputMetadata.find(({ name }) => name === "c");
  const flowConditioningRank = flowConditioningInput?.isTensor
    ? flowConditioningInput.shape.length
    : 1;

  const generatedFrames: Float32Array[] = [];
  let currentLatent = new Float32Array(latentDim);
  currentLatent.fill(Number.NaN); // NaN = BOS latent

  const noiseStd = Math.sqrt(Math.max(0, temperature));
  let eosHit = false;
  let extraCount = 0;

  for (let step = 0; step < maxFrames; step++) {
    if (step % 4 === 0) {
      onProgress("generatingFrames", 0.72 + (step / maxFrames) * 0.18, gpu);
    }

    const stepFeeds: Record<string, ort.Tensor> = {
      ...mainStateFeeds,
      [seqInputName]: new Tensor("float32", currentLatent, [1, 1, latentDim]),
    };
    if (textInputName) {
      stepFeeds[textInputName] = new Tensor("float32", new Float32Array(0), [
        1,
        0,
        condDim,
      ]);
    }

    const mainOut = await runSession(runtime, provider, pack.flowLmMain, stepFeeds);
    mapStateOutputsToInputs(
      pack.flowLmMain.inputNames,
      pack.flowLmMain.outputNames,
      mainOut,
      mainStateFeeds
    );

    const conditioning = mainOut[pack.flowLmMain.outputNames[0]];
    const eosOut = mainOut[pack.flowLmMain.outputNames[1]];
    const eosLogit = eosOut ? Number((eosOut.data as Float32Array)[0] ?? -10) : -10;

    if (!eosHit && eosLogit > eosThreshold) {
      eosHit = true;
    }
    if (eosHit) {
      extraCount++;
      if (extraCount > eosExtraFrames) {
        break;
      }
    }

    // Flow-matching Euler LSD integration: x += flow_dir(c, s, t, x) * dt
    const fx =
      noiseStd > 0 ? sampleStandardNormal(latentDim) : new Float32Array(latentDim);
    if (noiseStd > 0) {
      for (let i = 0; i < fx.length; i++) fx[i] *= noiseStd;
    }

    // PocketTTS.cpp exports c as an unbatched vector.
    const condTensor = conditioning.dims.length === flowConditioningRank
      ? conditioning
      : conditioning.reshape(flowConditioningRank === 1
        ? [conditioning.size]
        : [1, conditioning.size]);

    for (let j = 0; j < lsdSteps; j++) {
      const s = j / lsdSteps;
      const t = s + dt;
      const flowOut = await runSession(runtime, provider, pack.flowLmFlow, {
        c: condTensor,
        s: new Tensor("float32", new Float32Array([s]), [1, 1]),
        t: new Tensor("float32", new Float32Array([t]), [1, 1]),
        x: new Tensor("float32", fx, [1, latentDim]),
      });
      const flowDir = flowOut[pack.flowLmFlow.outputNames[0]].data as Float32Array;
      for (let i = 0; i < latentDim; i++) {
        fx[i] += flowDir[i] * dt;
      }
    }

    const nextLatent = new Float32Array(fx);
    generatedFrames.push(nextLatent);
    currentLatent = nextLatent;
  }

  if (!eosHit) return null;

  // Decode generated latents with Mimi decoder using inputMetadata-typed state
  onProgress("decodingWaveform", 0.92, gpu);
  const decMetas = getInputMetas(pack.mimiDecoder);
  const decStateFeeds: Record<string, ort.Tensor> = {};
  let decLatentName = pack.mimiDecoder.inputNames[0];

  for (const meta of decMetas) {
    const lower = meta.name.toLowerCase();
    if (lower.includes("latent") || meta.name === pack.mimiDecoder.inputNames[0]) {
      decLatentName = meta.name;
    } else {
      decStateFeeds[meta.name] = createZeroTensorFromMeta(Tensor, meta);
    }
  }

  const pcmChunks: Float32Array[] = [];
  for (const frame of generatedFrames) {
    if (pcmChunks.length % 8 === 0) {
      onProgress("decodingWaveform", 0.92 + (pcmChunks.length / generatedFrames.length) * 0.05, gpu);
    }
    const decFeeds: Record<string, ort.Tensor> = {
      ...decStateFeeds,
      [decLatentName]: new Tensor("float32", frame, [1, 1, latentDim]),
    };
    const decOut = await runSession(runtime, provider, pack.mimiDecoder, decFeeds);
    mapStateOutputsToInputs(
      pack.mimiDecoder.inputNames,
      pack.mimiDecoder.outputNames,
      decOut,
      decStateFeeds
    );
    const audioData = decOut[pack.mimiDecoder.outputNames[0]].data as Float32Array;
    pcmChunks.push(new Float32Array(audioData));
  }

  return pcmChunks;
}

function textTensorOrCombined(Tensor: Runtime["Tensor"], textEmb: ort.Tensor, voiceTensor: ort.Tensor): ort.Tensor {
  const tData = textEmb.data as Float32Array;
  const vData = voiceTensor.data as Float32Array;
  const tDims = textEmb.dims;
  const vDims = voiceTensor.dims;
  const dim = Number(tDims[tDims.length - 1] ?? vDims[vDims.length - 1] ?? 1024);
  const totalFrames = Math.floor((tData.length + vData.length) / dim);
  const combined = new Float32Array(vData.length + tData.length);
  combined.set(vData, 0);
  combined.set(tData, vData.length);
  return new Tensor("float32", combined, [1, totalFrames, dim]);
}
