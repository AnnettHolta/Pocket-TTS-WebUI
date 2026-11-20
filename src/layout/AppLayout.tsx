import { createSignal, For } from "solid-js";
import type { JSX } from "@solidjs/web";
import {
  TbOutlineCheck,
  TbOutlineCopy,
  TbOutlineCpu,
  TbOutlineDatabase,
  TbOutlineExternalLink,
  TbOutlineHistory,
  TbOutlineSparkles,
} from "solid-icons/tb";
import Badge from "../components/Badge";
import HardwareModal from "../components/HardwareModal";
import { locale, LOCALE_OPTIONS, setLocale, t, type Locale } from "../i18n";
import type { HardwareInfo } from "../lib/hardwareInfo";
import "./AppLayout.css";

export type PageTab = "studio" | "history";

export interface AppLayoutProps {
  activePage: PageTab;
  onNavigate: (page: PageTab) => void;
  historyCount: number;
  webGpuAvailable: boolean;
  hardwareInfo: HardwareInfo | null;
  children: JSX.Element;
}

const HF_REPO = "stephvax/pocket-tts-onnx";

export default function AppLayout(props: AppLayoutProps) {
  const [copied, setCopied] = createSignal(false);
  const [hardwareOpen, setHardwareOpen] = createSignal(false);

  const handleCopyRepo = () => {
    void navigator.clipboard?.writeText(HF_REPO).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <main class="app-page">
      <header class="app-header">
        <div class="app-header-top">
          <div class="app-brand">
            <div class="app-logo">PT</div>
            <div>
              <h1 class="app-title">PocketTTS</h1>
              <div class="app-repo-row">
                <span class="app-repo-label">ONNX:</span>
                <button
                  type="button"
                  class="app-repo-btn icon-label"
                  title="Click to copy repository path"
                  onClick={handleCopyRepo}
                >
                  <span>{copied() ? t("header.copied") : HF_REPO}</span>
                  {copied() ? <TbOutlineCheck size={11} /> : <TbOutlineCopy size={11} />}
                </button>
              </div>
            </div>
          </div>

          <div class="app-badges">
            <Badge
              tone={props.webGpuAvailable ? "ok" : "warn"}
              title={t("header.hardwareTitle")}
              onClick={() => setHardwareOpen(true)}
            >
              {props.webGpuAvailable ? t("header.webgpuReady") : t("header.cpuReady")}
            </Badge>
            <Badge>
              <TbOutlineDatabase size={12} />
              <span>{t("header.indexedDb", { count: props.historyCount })}</span>
            </Badge>
            <Badge>
              <TbOutlineCpu size={12} />
              <span>Solid 2.0</span>
            </Badge>
            <select
              class="app-locale-select"
              aria-label="UI Language"
              value={locale()}
              onChange={(e) => setLocale(e.currentTarget.value as Locale)}
            >
              <For each={LOCALE_OPTIONS}>
                {(opt) => (
                  <option value={opt.code}>
                    <span class="app-locale-flag">{opt.flag}</span>{" "}
                    <span>{opt.label}</span>
                  </option>
                )}
              </For>
            </select>
          </div>
        </div>

        <nav class="app-nav-tabs" aria-label="Views">
          <button
            type="button"
            class={`app-nav-tab icon-label ${props.activePage === "studio" ? "active" : ""}`}
            onClick={() => props.onNavigate("studio")}
          >
            <TbOutlineSparkles size={14} />
            <span>{t("nav.studio")}</span>
          </button>
          <button
            type="button"
            class={`app-nav-tab icon-label ${props.activePage === "history" ? "active" : ""}`}
            onClick={() => props.onNavigate("history")}
          >
            <TbOutlineHistory size={14} />
            <span>{t("nav.history", { count: props.historyCount })}</span>
          </button>
        </nav>
      </header>

      <div class="app-content">{props.children}</div>

      <footer class="app-footer">
        <span>
          {t("footer.engine")} • {props.webGpuAvailable ? "WebGPU" : "WASM"}
        </span>
        <div class="app-footer-links">
          <span>{t("footer.zeroCloud")}</span>
          <span>•</span>
          <a
            class="icon-label"
            href="https://huggingface.co/stephvax/pocket-tts-onnx"
            target="_blank"
            rel="noreferrer"
          >
            <span>Hugging Face</span>
            <TbOutlineExternalLink size={11} />
          </a>
          <span>•</span>
          <span class="mono">CC-BY-4.0</span>
        </div>
      </footer>

      <HardwareModal
        open={hardwareOpen()}
        info={props.hardwareInfo}
        onClose={() => setHardwareOpen(false)}
      />
    </main>
  );
}
