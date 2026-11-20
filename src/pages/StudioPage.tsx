import { Show } from "solid-js";
import { TbOutlineWand } from "solid-icons/tb";
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
  isGenerating: boolean;
  inferenceStage: string | null;
  inferenceProgress: number;
  queueLength: number;
  errorMessage: string | null;
  onDismissError: () => void;
  audioUrl: string | null;
  onGenerate: (e: Event) => void;
}

export default function StudioPage(props: StudioPageProps) {
  const buttonLabel = () => {
    if (!props.isGenerating) return "Generate Speech";
    const pct = Math.round(props.inferenceProgress * 100);
    const stageText = props.inferenceStage
      ? `${props.inferenceStage} (${pct}%)`
      : "Synthesizing...";
    return props.queueLength > 1
      ? `${stageText} • Queue ${props.queueLength}`
      : stageText;
  };
  return (
    <section class="card">
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
            <InferenceTextarea
              value={props.text}
              onInput={props.onTextInput}
              footer={
                <button
                  type="submit"
                  class="btn btn-primary studio-generate-btn"
                  disabled={props.isGenerating || !props.text.trim()}
                >
                  <TbOutlineWand size={15} />
                  <span>{buttonLabel()}</span>
                  <Show when={!props.isGenerating}>
                    <kbd class="studio-kbd">⌘↵</kbd>
                  </Show>
                </button>
              }
            />

            <Show when={props.errorMessage}>
              {(err) => (
                <div class="studio-error" role="alert">
                  <span>{err()}</span>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    onClick={() => props.onDismissError()}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </Show>
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
