import { Show } from "solid-js";
import { TbOutlineWand } from "solid-icons/tb";
import AudioDownload from "../components/AudioDownload";
import AudioPlayer from "../components/AudioPlayer";
import InferenceRefVoice from "../components/InferenceRefVoice";
import InferenceSettings, { type LanguageOption } from "../components/InferenceSettings";
import InferenceTextarea from "../components/InferenceTextarea";
import { t } from "../i18n";
import type { PrecisionMode, VoiceTranscriptRecord } from "../lib/historyDb";
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
  voiceNeedsAttachment: boolean;
  onUseSavedVoice: (voice: VoiceTranscriptRecord) => void;
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
  output: StudioOutput | null;
  onGenerate: (e: Event) => void;
  onCancel: () => void;
}

export interface StudioOutput {
  url: string;
  oggUrl: string;
  wav: Blob;
  name: string;
}

export default function StudioPage(props: StudioPageProps) {
  const buttonLabel = () => {
    if (!props.isGenerating) return t("studio.generate");
    const pct = Math.round(props.inferenceProgress * 100);
    const stageText = props.inferenceStage
      ? `${props.inferenceStage} (${pct}%)`
      : t("studio.synthesizing");
    return props.queueLength > 1
      ? `${stageText} • ${t("studio.queueSuffix", { count: props.queueLength })}`
      : stageText;
  };
  return (
    <section class="studio-page">
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
              voiceNeedsAttachment={props.voiceNeedsAttachment}
              onUseSavedVoice={props.onUseSavedVoice}
              onApplyVoice={props.onApplyVoice}
              onClear={props.onClearVoice}
            />
          </div>

          <div class="studio-col-right">
            <InferenceTextarea
              value={props.text}
              onInput={props.onTextInput}
              footer={
                <div class="studio-generate-actions">
                  <button
                    type="submit"
                    class="btn btn-primary studio-generate-btn"
                    disabled={props.isGenerating || props.voiceNeedsAttachment || !props.text.trim()}
                  >
                    <TbOutlineWand size={15} />
                    <span>{buttonLabel()}</span>
                  </button>
                  <Show when={props.isGenerating}>
                    <button type="button" class="btn btn-secondary" onClick={props.onCancel}>
                      {t("refVoice.cancel")}
                    </button>
                  </Show>
                </div>
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
                    {t("studio.dismiss")}
                  </button>
                </div>
              )}
            </Show>
          </div>
        </div>
      </form>

      <Show when={props.output} keyed>
        {(output) => (
          <div class="studio-output">
            <AudioPlayer src={output.url} downloadControl={<AudioDownload {...output} />} />
          </div>
        )}
      </Show>
    </section>
  );
}
