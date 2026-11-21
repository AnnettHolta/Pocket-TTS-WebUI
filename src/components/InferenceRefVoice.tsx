import { createSignal, Match, onCleanup, Show, Switch } from "solid-js";
import { TbOutlineMicrophone, TbOutlineWaveSine } from "solid-icons/tb";
import { t } from "../i18n";
import { hasSavedVoices, type VoiceTranscriptRecord } from "../lib/historyDb";
import RefVoiceModal from "./RefVoiceModal";
import VoicePickerModal from "./VoicePickerModal";
import "./InferenceRefVoice.css";

export interface InferenceRefVoiceProps {
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
  onClear: () => void;
}

export default function InferenceRefVoice(props: InferenceRefVoiceProps) {
  const [dialog, setDialog] = createSignal<"picker" | "upload" | "edit" | "reattach" | null>(null);
  const [checking, setChecking] = createSignal(false);
  const [error, setError] = createSignal("");
  let trigger: HTMLButtonElement | undefined;
  let returnToPicker = false;
  let disposed = false;
  onCleanup(() => { disposed = true; });

  const openVoiceDialog = async () => {
    if (checking()) return;
    setError("");
    returnToPicker = false;
    if (props.voiceNeedsAttachment) {
      setDialog("reattach");
      return;
    }
    setChecking(true);
    try {
      const saved = await hasSavedVoices();
      if (!disposed) setDialog(saved ? "picker" : "upload");
    } catch (cause) {
      if (!disposed) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!disposed) setChecking(false);
    }
  };

  const openFromPicker = (next: "upload" | "edit") => {
    returnToPicker = true;
    setDialog(next);
  };
  const closeVoiceDialog = () => {
    setDialog(null);
    requestAnimationFrame(() => {
      if (!disposed && !dialog()) trigger?.focus();
    });
  };
  const hasVoice = () => Boolean(props.voiceFile);
  const showExistingDraft = () => dialog() === "edit" || dialog() === "reattach";

  return (
    <section class="subcard inference-ref-voice" aria-labelledby="studio-ref-voice">
      <div class="field-header">
        <h2 id="studio-ref-voice" class="ref-voice-heading icon-label">
          <TbOutlineWaveSine size={13} />
          {t("refVoice.reference")}
        </h2>
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
            <div class="ref-voice-copy">
              <div class="ref-voice-title">
                {props.voiceFile?.name || props.voicePath || t("refVoice.defaultVoice")}
              </div>
            </div>
          </div>

          <button
            ref={trigger}
            type="button"
            class="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            aria-disabled={checking() ? "true" : undefined}
            onClick={() => void openVoiceDialog()}
          >
            {t(checking() ? "library.loading" : props.voiceNeedsAttachment ? "refVoice.reattachVoice" : hasVoice() ? "refVoice.changeVoice" : "refVoice.chooseVoice")}
          </button>
        </div>

        <Show when={props.voiceTranscript}>
          {(transcript) => (
            <div class="ref-voice-transcript-preview">“{transcript()}”</div>
          )}
        </Show>
      </div>
      <Show when={props.voiceNeedsAttachment}>
        <p class="ref-voice-notice" role="status">{t("refVoice.reattach")}</p>
      </Show>
      <Show when={error()}>
        {(message) => <p class="ref-voice-notice" role="alert">{message()}</p>}
      </Show>

      <Switch>
        <Match when={dialog() === "picker"}>
          <VoicePickerModal
            activeVoiceHash={hasVoice() ? props.voiceSha256 : null}
            onClose={closeVoiceDialog}
            onChoose={(voice) => {
              props.onUseSavedVoice(voice);
              closeVoiceDialog();
            }}
            onUpload={() => openFromPicker("upload")}
            onEditCurrent={hasVoice() ? () => openFromPicker("edit") : undefined}
          />
        </Match>
        <Match when={dialog()}>
          <RefVoiceModal
            open={true}
            heading={t(dialog() === "upload" ? "refVoice.uploadVoice" : dialog() === "reattach" ? "refVoice.reattachVoice" : "refVoice.editCurrent")}
            initialFile={showExistingDraft() ? props.voiceFile : null}
            initialPath={showExistingDraft() ? props.voicePath : ""}
            initialTranscript={showExistingDraft() ? props.voiceTranscript : ""}
            initialSha256={showExistingDraft() ? props.voiceSha256 : null}
            onClose={() => {
              if (returnToPicker) setDialog("picker");
              else closeVoiceDialog();
            }}
            onApply={(payload) => {
              returnToPicker = false;
              props.onApplyVoice(payload);
            }}
          />
        </Match>
      </Switch>
    </section>
  );
}
