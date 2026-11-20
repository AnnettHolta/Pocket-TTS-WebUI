import { Show } from "solid-js";
import type { HardwareInfo } from "../lib/hardwareInfo";
import Modal from "./Modal";
import "./HardwareModal.css";

export interface HardwareModalProps {
  open: boolean;
  info: HardwareInfo | null;
  onClose: () => void;
}

export default function HardwareModal(props: HardwareModalProps) {
  const gpuSummary = () => {
    const info = props.info;
    if (!info) return "Probing...";
    return (
      info.gpuDescription ||
      [info.gpuVendor, info.gpuArchitecture, info.gpuDevice].filter(Boolean).join(" • ") ||
      info.webglRenderer ||
      "Unavailable"
    );
  };

  return (
    <Modal open={props.open} title="Hardware & Execution Debug" onClose={props.onClose}>
      <Show when={props.info} fallback={<p class="hint">Probing hardware...</p>}>
        {(info) => (
          <div class="hw-grid">
            <div class="hw-item">
              <span class="hw-label">Execution Provider</span>
              <span class={`hw-value ${info().webGpuAdapterReady ? "ok" : "warn"}`}>
                {info().hardwareAcceleration}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">Hardware FP16 (shader-f16)</span>
              <span class={`hw-value ${info().fp16Supported ? "ok" : ""}`}>
                {info().fp16Supported ? "Enabled" : "Not reported"}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">FP32 Precision</span>
              <span class={`hw-value ${info().fp32Baseline ? "ok" : "warn"}`}>
                {info().fp32Baseline ? "Baseline (Supported)" : "Unavailable"}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">INT8 Acceleration (WASM SIMD)</span>
              <span class={`hw-value ${info().wasmSimdInt8 ? "ok" : "warn"}`}>
                {info().wasmSimdInt8 ? "v128 SIMD Enabled" : "Scalar fallback"}
              </span>
            </div>

            <div class="hw-item full">
              <span class="hw-label">GPU Adapter / Renderer</span>
              <span class="hw-value">{gpuSummary()}</span>
            </div>

            <div class="hw-item">
              <span class="hw-label">CPU Logical Cores</span>
              <span class="hw-value">
                {info().cpuCores !== null ? `${info().cpuCores} threads` : "Unknown"}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">Device Memory</span>
              <span class="hw-value">
                {info().deviceMemoryGB !== null ? `~${info().deviceMemoryGB} GB` : "Not exposed"}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">Max WebGPU Buffer</span>
              <span class="hw-value">
                {info().maxBufferSizeMB !== null ? `${info().maxBufferSizeMB} MB` : "N/A"}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">WASM Threads (COI / SAB)</span>
              <span class="hw-value">
                {info().crossOriginIsolated && info().sharedArrayBuffer
                  ? "Enabled"
                  : "Single-thread"}
              </span>
            </div>
          </div>
        )}
      </Show>

      <div class="hw-footer">
        <button type="button" class="btn btn-secondary" onClick={() => props.onClose()}>
          Close
        </button>
      </div>
    </Modal>
  );
}

