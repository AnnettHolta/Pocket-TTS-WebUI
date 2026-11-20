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

export default function AppLayout(props: AppLayoutProps) {
  return (
    <main class="app-page">
      <header class="app-header">
        <div class="app-brand">
          <div class="app-logo">PT</div>
          <div>
            <h1 class="app-title">PocketTTS WebUI</h1>
            <p class="app-subtitle">
              Local ONNX speech synthesis for <code>stephvax/pocket-tts-onnx</code>
            </p>
          </div>
        </div>

        <div class="app-badges">
          <Badge tone={props.webGpuAvailable ? "ok" : "warn"} dot>
            {props.webGpuAvailable ? "WebGPU Ready" : "WASM Fallback"}
          </Badge>
          <Badge>IndexedDB History</Badge>
          <Badge>Solid 2.0</Badge>
        </div>
      </header>

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

      {props.children}
    </main>
  );
}

