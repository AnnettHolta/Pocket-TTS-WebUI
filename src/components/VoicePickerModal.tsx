import { createSignal, For, onCleanup, onSettled, Show, untrack } from "solid-js";
import { TbOutlineCheck, TbOutlineChevronRight, TbOutlinePlayerPlay, TbOutlinePlayerStop, TbOutlineUpload } from "solid-icons/tb";
import { t } from "../i18n";
import createLibraryPreview from "../lib/createLibraryPreview";
import createStoredList from "../lib/createStoredList";
import { listSavedVoicesPage, type VoiceTranscriptRecord } from "../lib/historyDb";
import LibrarySearch from "./LibrarySearch";
import Modal from "./Modal";
import TablePagination from "./table/TablePagination";
import "./LibraryList.css";
import "./VoicePickerModal.css";

function PickerVoice(props: {
  voice: VoiceTranscriptRecord;
  audio: Blob;
  selected: boolean;
  playing: boolean;
  onPlay: (url: string) => void;
  onChoose: () => void;
}) {
  let url: string | undefined;
  onCleanup(() => {
    if (url) URL.revokeObjectURL(url);
  });

  return (
    <li class="library-row voice-picker-row">
      <button
        type="button"
        class="btn btn-secondary library-preview"
        aria-label={`${t(props.playing ? "voices.pause" : "voices.preview")}: ${props.voice.fileName}`}
        onClick={() => props.onPlay(url ??= URL.createObjectURL(untrack(() => props.audio)))}
      >
        <Show when={props.playing} fallback={<TbOutlinePlayerPlay size={14} />}>
          <TbOutlinePlayerStop size={14} />
        </Show>
      </button>
      <button
        type="button"
        class="btn btn-ghost voice-picker-option"
        aria-pressed={props.selected ? "true" : "false"}
        onClick={props.onChoose}
      >
        <span class="voice-picker-label">
          <strong>{props.voice.fileName}</strong>
          <Show when={props.voice.transcript}>
            {(transcript) => <small>{transcript()}</small>}
          </Show>
        </span>
        <Show when={props.selected} fallback={<TbOutlineChevronRight size={14} />}>
          <TbOutlineCheck size={16} />
        </Show>
      </button>
    </li>
  );
}

export default function VoicePickerModal(props: {
  activeVoiceHash: string | null;
  onClose: () => void;
  onChoose: (voice: VoiceTranscriptRecord) => void;
  onUpload: () => void;
  onEditCurrent?: () => void;
}) {
  const [error, setError] = createSignal("");
  const list = createStoredList(listSavedVoicesPage, (cause) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  });
  const preview = createLibraryPreview();
  onSettled(() => { void list.refresh(); });

  return (
    <Modal open={true} heading={t("refVoice.chooseSaved")} onClose={props.onClose}>
      <div class="library-section voice-picker" aria-busy={list.loading() ? "true" : undefined}>
        <Show when={list.result().totalItems > 1 || list.search()}>
          <LibrarySearch
            label={t("voices.search")}
            value={list.search()}
            onInput={(value) => {
              preview.stop();
              list.changeSearch(value);
            }}
          />
        </Show>
        <Show when={error()}>{(message) => <p class="voice-picker-error" role="alert">{message()}</p>}</Show>
        <Show when={preview.error()}><p class="voice-picker-error" role="alert">{t("voices.previewError")}</p></Show>
        <Show when={list.result().items.length} fallback={
          <p class="library-empty">{t(list.loading() ? "library.loading" : list.search() ? "library.noMatches" : "voices.empty")}</p>
        }>
          <ul class="library-list">
            <For each={list.result().items} keyed={(voice) => voice.sha256}>
              {(voice) => (
                <Show when={voice().audio}>
                  {(audio) => (
                    <PickerVoice
                      voice={voice()}
                      audio={audio()}
                      selected={props.activeVoiceHash === voice().sha256}
                      playing={preview.playing() === voice().sha256}
                      onPlay={(url) => void preview.play(voice().sha256, url)}
                      onChoose={() => props.onChoose(voice())}
                    />
                  )}
                </Show>
              )}
            </For>
          </ul>
        </Show>
        <Show when={list.result().totalMatches > list.result().pageSize}>
          <TablePagination
            page={list.result().page}
            pageSize={list.result().pageSize}
            totalItems={list.result().totalMatches}
            onPageChange={(page) => {
              preview.stop();
              list.changePage(page);
            }}
          />
        </Show>
        <footer class="voice-picker-footer">
          <Show when={props.onEditCurrent}>
            <button type="button" class="btn btn-ghost" onClick={() => props.onEditCurrent?.()}>
              {t("refVoice.editCurrent")}
            </button>
          </Show>
          <button type="button" class="btn btn-secondary" onClick={props.onUpload}>
            <TbOutlineUpload size={15} />
            {t("refVoice.uploadVoice")}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
