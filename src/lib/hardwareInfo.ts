export interface HardwareInfo {
  webGpuApiPresent: boolean;
  webGpuAdapterReady: boolean;
  hardwareAcceleration: "WebGPU" | "CPU (WASM)";
  fp16Supported: boolean;
  fp32Baseline: boolean;
  wasmSimdInt8: boolean;
  gpuVendor: string | null;
  gpuArchitecture: string | null;
  gpuDevice: string | null;
  gpuDescription: string | null;
  isFallbackAdapter: boolean | null;
  maxBufferSizeMB: number | null;
  webglRenderer: string | null;
  cpuCores: number | null;
  deviceMemoryGB: number | null;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
}

function checkWasmSimd(): boolean {
  try {
    if (typeof WebAssembly !== "object" || typeof WebAssembly.validate !== "function") {
      return false;
    }
    // Minimal WASM module with a single () -> v128 function using v128.const
    const simdProbe = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
      0x03, 0x02, 0x01, 0x00,
      0x0a, 0x16, 0x01, 0x14, 0x00,
      0xfd, 0x0c,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0x0b,
    ]);
    return WebAssembly.validate(simdProbe);
  } catch {
    return false;
  }
}

function getWebGlRenderer(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      return (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || null;
    }
    return (gl.getParameter(gl.RENDERER) as string) || null;
  } catch {
    return null;
  }
}

export async function probeHardwareInfo(): Promise<HardwareInfo> {
  const webGpuApiPresent = "gpu" in navigator && Boolean(navigator.gpu);
  let webGpuAdapterReady = false;
  let fp16Supported = false;
  let gpuVendor: string | null = null;
  let gpuArchitecture: string | null = null;
  let gpuDevice: string | null = null;
  let gpuDescription: string | null = null;
  let isFallbackAdapter: boolean | null = null;
  let maxBufferSizeMB: number | null = null;

  if (webGpuApiPresent) {
    try {
      const gpu = (navigator as Navigator & { gpu: any }).gpu;
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        webGpuAdapterReady = true;
        fp16Supported = Boolean(adapter.features?.has?.("shader-f16"));

        const info = adapter.info ?? (await adapter.requestAdapterInfo?.());
        if (info) {
          gpuVendor = info.vendor || null;
          gpuArchitecture = info.architecture || null;
          gpuDevice = info.device || null;
          gpuDescription = info.description || null;
          if (typeof info.isFallbackAdapter === "boolean") {
            isFallbackAdapter = info.isFallbackAdapter;
          }
        }

        const maxBuf = adapter.limits?.maxBufferSize;
        if (typeof maxBuf === "number" && Number.isFinite(maxBuf)) {
          maxBufferSizeMB = Math.round(maxBuf / (1024 * 1024));
        }
      }
    } catch {
      webGpuAdapterReady = false;
    }
  }

  const nav = navigator as Navigator & { deviceMemory?: number };

  return {
    webGpuApiPresent,
    webGpuAdapterReady,
    hardwareAcceleration: webGpuAdapterReady ? "WebGPU" : "CPU (WASM)",
    fp16Supported,
    fp32Baseline: webGpuAdapterReady || typeof WebAssembly === "object",
    wasmSimdInt8: checkWasmSimd(),
    gpuVendor,
    gpuArchitecture,
    gpuDevice,
    gpuDescription,
    isFallbackAdapter,
    maxBufferSizeMB,
    webglRenderer: getWebGlRenderer(),
    cpuCores: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
    deviceMemoryGB: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    crossOriginIsolated: Boolean(window.crossOriginIsolated),
  };
}

