import { Show } from "solid-js";
import { t } from "../i18n";
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
    if (!info) return t("hardware.probing");
    return (
      info.gpuDescription ||
      [info.gpuVendor, info.gpuArchitecture, info.gpuDevice].filter(Boolean).join(" • ") ||
      info.webglRenderer ||
      t("hardware.unavailable")
    );
  };

  return (
    <Modal open={props.open} heading={t("hardware.title")} onClose={props.onClose}>
      <Show when={props.info} fallback={<p class="hint">{t("hardware.probing")}</p>}>
        {(info) => (
          <div class="hw-grid">
            <div class="hw-item">
              <span class="hw-label">{t("hardware.provider")}</span>
              <span class={`hw-value ${info().hardwareAcceleration === "WebGPU" ? "ok" : "warn"}`}>
                {info().hardwareAcceleration}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">{t("hardware.fp16")}</span>
              <span class={`hw-value ${info().fp16Supported ? "ok" : ""}`}>
                {info().fp16Supported
                  ? t("hardware.fp16Enabled")
                  : t("hardware.fp16NotReported")}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">{t("hardware.fp32")}</span>
              <span class={`hw-value ${info().fp32Baseline ? "ok" : "warn"}`}>
                {info().fp32Baseline ? t("hardware.fp32Baseline") : t("hardware.unavailable")}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">{t("hardware.int8Simd")}</span>
              <span class={`hw-value ${info().wasmSimdInt8 ? "ok" : "warn"}`}>
                {info().wasmSimdInt8 ? t("hardware.simdEnabled") : t("hardware.simdScalar")}
              </span>
            </div>

            <div class="hw-item full">
              <span class="hw-label">{t("hardware.gpuAdapter")}</span>
              <span class="hw-value">{gpuSummary()}</span>
            </div>

            <div class="hw-item">
              <span class="hw-label">{t("hardware.cpuCores")}</span>
              <span class="hw-value">
                {info().cpuCores !== null
                  ? t("hardware.threads", { count: info().cpuCores! })
                  : t("hardware.unknown")}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">{t("hardware.memory")}</span>
              <span class="hw-value">
                {info().deviceMemoryGB !== null
                  ? `~${info().deviceMemoryGB} GB`
                  : t("hardware.notExposed")}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">{t("hardware.maxBuffer")}</span>
              <span class="hw-value">
                {info().maxBufferSizeMB !== null ? `${info().maxBufferSizeMB} MB` : "N/A"}
              </span>
            </div>

            <div class="hw-item">
              <span class="hw-label">{t("hardware.wasmThreads")}</span>
              <span class="hw-value">
                {info().crossOriginIsolated && info().sharedArrayBuffer
                  ? t("hardware.enabled")
                  : t("hardware.singleThread")}
              </span>
            </div>
          </div>
        )}
      </Show>

      <aside class="hw-dev-note" role="note">
        <h4>{t("hardware.memoryNote")}</h4>
        <dl class="hw-memory-runs">
          <div>
            <dt>INT8 + FP32 <span class="hw-memory-peak">4.74 GiB</span></dt>
            <dd>{t("hardware.mixedMemoryRun")}</dd>
          </div>
          <div>
            <dt>INT8 <span class="hw-memory-peak">~1.9 GB</span></dt>
            <dd>{t("hardware.int8MemoryRun")}</dd>
          </div>
        </dl>
      </aside>

      <div class="hw-footer">
        <button type="button" class="btn btn-secondary" onClick={() => props.onClose()}>
          {t("hardware.close")}
        </button>
      </div>
    </Modal>
  );
}

