import { createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
import Badge from "../components/Badge";
import "./AppLayout.css";

export type PageTab = "studio" | "history";

export interface AppLayoutProps {
  activePage: PageTab;
  onNavigate: (page: PageTab) => void;
  historyCount: number;
  webGpuAvailable: boolean;
  children: JSX.Element;
}

const HF_REPO = "stephvax/pocket-tts-onnx";

export default function AppLayout(props: AppLayoutProps) {
  const [copied, setCopied] = createSignal(false);

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
                  class="app-repo-btn"
                  title="Click to copy repository path"
                  onClick={handleCopyRepo}
                >
                  {copied() ? "Copied!" : HF_REPO}
                </button>
              </div>
            </div>
          </div>

          <div class="app-badges">
            <Badge tone={props.webGpuAvailable ? "ok" : "warn"} dot>
              {props.webGpuAvailable ? "WebGPU Ready" : "WASM Fallback"}
            </Badge>
            <Badge>IndexedDB ({props.historyCount})</Badge>
            <Badge>Solid 2.0</Badge>
          </div>
        </div>

        <nav class="app-nav-tabs" aria-label="Views">
          <button
            type="button"
            class={`app-nav-tab ${props.activePage === "studio" ? "active" : ""}`}
            onClick={() => props.onNavigate("studio")}
          >
            Studio
          </button>
          <button
            type="button"
            class={`app-nav-tab ${props.activePage === "history" ? "active" : ""}`}
            onClick={() => props.onNavigate("history")}
          >
            History ({props.historyCount})
          </button>
        </nav>
      </header>

      <div class="app-content">{props.children}</div>

      <footer class="app-footer">
        <span>PocketTTS ONNX Engine • {props.webGpuAvailable ? "WebGPU" : "WASM"}</span>
        <div class="app-footer-links">
          <span>Zero Cloud Dependencies</span>
          <span>•</span>
          <a
            href="https://huggingface.co/stephvax/pocket-tts-onnx"
            target="_blank"
            rel="noreferrer"
          >
            Hugging Face
          </a>
          <span>•</span>
          <span class="mono">CC-BY-4.0</span>
        </div>
      </footer>
    </main>
  );
}
