import { Show } from "solid-js";
import InferenceRefVoice from "../components/InferenceRefVoice";
import InferenceSettings, { type LanguageOption } from "../components/InferenceSettings";
import InferenceTextarea from "../components/InferenceTextarea";
import type { PrecisionMode } from "../lib/historyDb";
import "./StudioPage.css";

export interface StudioPageProps {
  languages: LanguageOption[];
  selectedLang: string;
  onSelectLang: (id: string) => void;
  currentCached: boolean;
  precision: PrecisionMode;
  onSelectPrecision: (mode: PrecisionMode) => void;
  temperature: number;
  onChangeTemperature: (value: number) => void;
  voiceFile: File | null;
  voicePath: string;
  onVoiceFileChange: (file: File | null, detectedPath: string) => void;
  onVoicePathInput: (path: string) => void;
  onClearVoice: () => void;
  text: string;
  onTextInput: (value: string) => void;
  status: string;
  isGenerating: boolean;
  audioUrl: string | null;
  onGenerate: (e: Event) => void;
}

export default function StudioPage(props: StudioPageProps) {
  return (
    <div class="studio-stack">
      <form class="card" onSubmit={(e) => props.onGenerate(e)}>
        <div class="card-title-row">
          <h2 class="card-title">Synthesis Studio</h2>
          <span class="hint">
            {props.currentCached ? "Cached locally" : "Download on demand"}
          </span>
        </div>

        <InferenceSettings
          languages={props.languages}
          selectedLang={props.selectedLang}
          onSelectLang={props.onSelectLang}
          precision={props.precision}
          onSelectPrecision={props.onSelectPrecision}
          temperature={props.temperature}
          onChangeTemperature={props.onChangeTemperature}
        />

        <InferenceRefVoice
          voiceFile={props.voiceFile}
          voicePath={props.voicePath}
          onFileChange={props.onVoiceFileChange}
          onPathInput={props.onVoicePathInput}
          onClear={props.onClearVoice}
        />

        <InferenceTextarea value={props.text} onInput={props.onTextInput} />

        <div class="studio-actions">
          <span class="studio-status">{props.status}</span>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={props.isGenerating || !props.text.trim()}
          >
            {props.isGenerating ? "Synthesizing..." : "Generate Speech"}
          </button>
        </div>
      </form>

      <Show when={props.audioUrl}>
        {(url) => (
          <section class="card">
            <h2 class="card-title">Output Audio</h2>
            <div class="studio-audio">
              <audio controls src={url()} />
              <a
                class="btn btn-secondary"
                href={url()}
                download={`pocket-tts-${props.selectedLang}.wav`}
              >
                Download WAV
              </a>
            </div>
          </section>
        )}
      </Show>
    </div>
  );
}
