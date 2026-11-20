import { Show } from "solid-js";
import AudioPlayer from "../components/AudioPlayer";
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
  voiceTranscript: string;
  voiceSha256: string | null;
  onApplyVoice: (payload: {
    file: File | null;
    path: string;
    transcript: string;
    sha256: string | null;
  }) => void;
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
    <section class="card">
      <div class="card-title-row studio-header">
        <div class="studio-title-group">
          <h2 class="card-title">Synthesis Studio</h2>
          <span class="pill-value">{props.isGenerating ? "Running" : "Ready"}</span>
          <span class="hint mono">• on-device neural voice</span>
        </div>
        <span class="hint">
          {props.currentCached ? "Cached locally" : "Download on demand"}
        </span>
      </div>

      <form onSubmit={(e) => props.onGenerate(e)}>
        <div class="studio-grid">
          <div class="studio-col-left">
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
              voiceTranscript={props.voiceTranscript}
              voiceSha256={props.voiceSha256}
              onApplyVoice={props.onApplyVoice}
              onClear={props.onClearVoice}
            />
          </div>

          <div class="studio-col-right">
            <InferenceTextarea value={props.text} onInput={props.onTextInput} />

            <div class="studio-footer">
              <span class="studio-status">{props.status}</span>
              <button
                type="submit"
                class="btn btn-primary"
                disabled={props.isGenerating || !props.text.trim()}
              >
                <span>{props.isGenerating ? "Synthesizing..." : "Generate Speech"}</span>
                <kbd class="studio-kbd">⌘↵</kbd>
              </button>
            </div>
          </div>
        </div>
      </form>

      <Show when={props.audioUrl}>
        {(url) => (
          <div class="studio-output">
            <AudioPlayer
              src={url()}
              downloadName={`pocket-tts-${props.selectedLang}.wav`}
            />
          </div>
        )}
      </Show>
    </section>
  );
}
