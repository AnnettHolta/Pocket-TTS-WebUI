import { render } from "@solidjs/web";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import HardwareModal from "./HardwareModal";

describe("HardwareModal", () => {
  let dispose: (() => void) | undefined;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function () {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("displays WebGPU, FP16, FP32, and WASM SIMD diagnostics", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <HardwareModal
          open={true}
          onClose={vi.fn()}
          info={{
            webGpuApiPresent: true,
            webGpuAdapterReady: true,
            hardwareAcceleration: "WebGPU",
            fp16Supported: true,
            fp32Baseline: true,
            wasmSimdInt8: true,
            gpuVendor: "NVIDIA",
            gpuArchitecture: "Ada",
            gpuDevice: "RTX",
            gpuDescription: "NVIDIA GeForce RTX",
            isFallbackAdapter: false,
            maxBufferSizeMB: 2048,
            webglRenderer: null,
            cpuCores: 16,
            deviceMemoryGB: 8,
            sharedArrayBuffer: false,
            crossOriginIsolated: false,
          }}
        />
      ),
      host
    );

    expect(host.textContent).toContain("WebGPU");
    expect(host.textContent).toContain("NVIDIA GeForce RTX");
    expect(host.textContent).toContain("v128 SIMD");
    expect(host.textContent).toContain("2048 MB");

    const memoryNote = host.querySelector('[role="note"]');
    expect(memoryNote?.textContent).toContain("INT8 + FP32 4.74 GiB");
    expect(memoryNote?.textContent).toContain("INT8 ~1.9 GB");
    expect(memoryNote?.textContent).toContain("User-reported peak in a separate run");
  });
});

