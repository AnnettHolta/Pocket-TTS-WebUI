import { createSignal, For, Show } from "solid-js";
import RefVoiceModal from "../components/RefVoiceModal";
import StoredAudio from "../components/StoredAudio";
import { t } from "../i18n";
import type { VoiceTranscriptRecord } from "../lib/historyDb";
import "./VoicesPage.css";

export interface VoicesPageProps {
  voices: VoiceTranscriptRecord[];
  onUse: (voice: VoiceTranscriptRecord) => void;
  onDelete: (sha256: string) => void;
  onSaved: () => void;
}

export default function VoicesPage(props: VoicesPageProps) {
  const [uploadOpen, setUploadOpen] = createSignal(false);
  const [editing, setEditing] = createSignal<VoiceTranscriptRecord | null>(null);
  const editingFile = () => {
    const voice = editing();
    return voice?.audio ? new File([voice.audio], voice.fileName, { type: voice.audio.type }) : null;
  };
  const closeModal = () => {
    setUploadOpen(false);
    setEditing(null);
  };

  return (
    <section class="card voice-library">
      <div class="field-header">
        <h2>{t("nav.voices")}</h2>
        <button type="button" class="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
          {t("voices.add")}
        </button>
      </div>
      <For each={props.voices} fallback={<p class="hint">{t("voices.empty")}</p>}>
        {(voice) => (
          <article class="subcard voice-library-item">
            <h3>{voice.fileName}</h3>
            <Show when={voice.transcript}><p>{voice.transcript}</p></Show>
            <Show when={voice.audio}>
              {(audio) => <StoredAudio audio={audio()} name={voice.fileName.replace(/\.[^.]+$/, "") + ".ogg"} />}
            </Show>
            <div class="voice-library-actions">
              <button type="button" class="btn btn-primary btn-sm" onClick={() => props.onUse(voice)}>
                {t("voices.use")}
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onClick={() => {
                setEditing(voice);
                setUploadOpen(true);
              }}>
                {t("refVoice.edit")}
              </button>
              <button type="button" class="btn btn-ghost btn-sm" onClick={() => props.onDelete(voice.sha256)}>
                {t("history.delete")}
              </button>
            </div>
          </article>
        )}
      </For>
      <RefVoiceModal
        open={uploadOpen()}
        initialFile={editingFile()}
        initialPath={editing()?.filePath ?? ""}
        initialTranscript={editing()?.transcript ?? ""}
        initialSha256={editing()?.sha256 ?? null}
        onClose={closeModal}
        onApply={props.onSaved}
      />
    </section>
  );
}
