import { createSignal, Show } from "solid-js";
import { TbOutlineMicrophone, TbOutlineWaveSine } from "solid-icons/tb";
import { t } from "../i18n";
import RefVoiceModal from "./RefVoiceModal";
import "./InferenceRefVoice.css";

export interface InferenceRefVoiceProps {
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
  onClear: () => void;
}

export default function InferenceRefVoice(props: InferenceRefVoiceProps) {
  const [modalOpen, setModalOpen] = createSignal(false);

  return (
    <section class="subcard inference-ref-voice">
      <div class="field-header">
        <label class="icon-label">
          <TbOutlineWaveSine size={13} />
          <span>
            {t("refVoice.title")} <span class="hint">{t("refVoice.optional")}</span>
          </span>
        </label>
        <Show when={props.voiceFile || props.voicePath || props.voiceTranscript}>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onClick={() => props.onClear()}
          >
            {t("refVoice.clear")}
          </button>
        </Show>
      </div>

      <div class="ref-voice-box">
        <div class="ref-voice-top">
          <div class="ref-voice-info">
            <div class="ref-voice-icon">
              <TbOutlineMicrophone size={15} />
            </div>
            <div>
              <div class="ref-voice-title">
                {props.voiceFile
                  ? props.voiceFile.name
                  : props.voicePath || t("refVoice.uploadPrompt")}
              </div>
              <div class="ref-voice-sub">
                {props.voiceSha256
                  ? `sha256: ${props.voiceSha256.slice(0, 10)}…`
                  : t("refVoice.recommended")}
              </div>
            </div>
          </div>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onClick={() => setModalOpen(true)}
          >
            {props.voiceFile ? t("refVoice.edit") : t("refVoice.choose")}
          </button>
        </div>

        <Show when={props.voiceTranscript}>
          {(transcript) => (
            <div class="ref-voice-transcript-preview">“{transcript()}”</div>
          )}
        </Show>
      </div>

      <RefVoiceModal
        open={modalOpen()}
        initialFile={props.voiceFile}
        initialPath={props.voicePath}
        initialTranscript={props.voiceTranscript}
        initialSha256={props.voiceSha256}
        onClose={() => setModalOpen(false)}
        onApply={props.onApplyVoice}
      />
    </section>
  );
}
