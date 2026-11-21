import { createSignal, For, onCleanup, Show, untrack } from "solid-js";
import {
  TbOutlineCheck,
  TbOutlineDownload,
  TbOutlineEdit,
  TbOutlinePlayerPlay,
  TbOutlinePlayerStop,
  TbOutlinePlus,
  TbOutlineTrash,
  TbOutlineUpload,
  TbOutlineWaveSine,
} from "solid-icons/tb";
import GeneralConfirmModal from "../components/GeneralConfirmModal";
import RefVoiceModal, { type RefVoiceModalProps } from "../components/RefVoiceModal";
import LibraryMenu from "../components/LibraryMenu";
import LibrarySearch from "../components/LibrarySearch";
import TablePagination from "../components/table/TablePagination";
import { t } from "../i18n";
import createLibraryPreview from "../lib/createLibraryPreview";
import type { StoredList } from "../lib/createStoredList";
import type { VoiceTranscriptRecord } from "../lib/historyDb";
import "../components/LibraryList.css";
import "./VoicesPage.css";

export interface VoicesPageProps {
  list: StoredList<VoiceTranscriptRecord>;
  activeVoiceHash: string | null;
  onUse: (voice: VoiceTranscriptRecord) => void;
  onDelete: (sha256: string) => void;
  onSaved: RefVoiceModalProps["onApply"];
}

interface VoiceRowProps {
  voice: VoiceTranscriptRecord;
  audio: Blob;
  active: boolean;
  playing: boolean;
  onPreview: (src: string) => void;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function VoiceRow(props: VoiceRowProps) {
  const url = URL.createObjectURL(untrack(() => props.audio));
  onCleanup(() => URL.revokeObjectURL(url));

  const previewLabel = () => t(props.playing ? "voices.pause" : "voices.preview");
  const useLabel = () => t(props.active ? "voices.active" : "voices.use");

  return (
    <li class="library-row voices-row">
      <button
        type="button"
        class="btn btn-secondary library-preview"
        aria-label={`${previewLabel()}: ${props.voice.fileName}`}
        onClick={() => props.onPreview(url)}
      >
        <Show when={props.playing} fallback={<TbOutlinePlayerPlay size={14} />}>
          <TbOutlinePlayerStop size={14} />
        </Show>
      </button>

      <div class="library-row-info">
        <h3>{props.voice.fileName}</h3>
        <p>
          {props.voice.transcript || "Ogg audio"}
        </p>
      </div>

      <button
        type="button"
        class={`btn btn-secondary library-action${props.active ? " library-action-active" : ""}`}
        aria-label={useLabel()}
        onClick={props.onUse}
      >
        <TbOutlineCheck size={16} />
        <span>{t(props.active ? "voices.active" : "voices.useShort")}</span>
      </button>

      <LibraryMenu label={t("voices.actions")}>
        {(close) => (
          <>
            <button type="button" class="btn btn-ghost" onClick={() => { close(); props.onEdit(); }}>
              <TbOutlineEdit size={15} />
              {t("refVoice.edit")}
            </button>
            <a
              class="btn btn-ghost"
              href={url}
              download={props.voice.fileName.replace(/\.[^.]+$/, "") + ".ogg"}
              onClick={close}
            >
              <TbOutlineDownload size={15} />
              {t("player.downloadOgg")}
            </a>
            <button type="button" class="btn btn-ghost library-delete" onClick={() => { close(); props.onDelete(); }}>
              <TbOutlineTrash size={15} />
              {t("history.delete")}
            </button>
          </>
        )}
      </LibraryMenu>
    </li>
  );
}

export default function VoicesPage(props: VoicesPageProps) {
  const [uploadOpen, setUploadOpen] = createSignal(false);
  const [editing, setEditing] = createSignal<VoiceTranscriptRecord | null>(null);
  const [pendingDeletion, setPendingDeletion] = createSignal<Pick<VoiceTranscriptRecord, "sha256" | "fileName"> | null>(null);
  const [droppedFile, setDroppedFile] = createSignal<File | null>(null);
  const [dragging, setDragging] = createSignal(false);
  const preview = createLibraryPreview();

  const openModal = (voice: VoiceTranscriptRecord | null = null, file: File | null = null) => {
    preview.stop();
    setEditing(voice);
    setDroppedFile(file);
    setUploadOpen(true);
  };

  const editingFile = () => {
    const voice = editing();
    return voice?.audio ? new File([voice.audio], voice.fileName, { type: voice.audio.type }) : null;
  };

  return (
    <div class="voices-page">
      <section class="voices-import" aria-labelledby="voices-import-title">
        <div class="voices-import-intro">
          <div class="voices-import-icon" aria-hidden="true"><TbOutlineWaveSine size={18} /></div>
          <div>
            <h2 id="voices-import-title">{t("refVoice.title")}</h2>
            <p>{t("refVoice.dropSub")}</p>
          </div>
        </div>
        <div
          class={`voices-dropzone${dragging() ? " voices-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer?.files[0];
            if (file) openModal(null, file);
          }}
        >
          <button type="button" class="btn btn-secondary btn-sm" onClick={() => openModal()}>
            <TbOutlineUpload size={14} />
            {t("voices.add")}
          </button>
          <small>{t("voices.dropHint")}</small>
        </div>
      </section>

      <section class="library-section" aria-labelledby="saved-voices-title" aria-busy={props.list.loading() ? "true" : undefined}>
        <header class="library-section-heading">
          <div class="library-section-title">
            <h2 id="saved-voices-title">{t("voices.saved")}</h2>
            <span aria-label={t("voices.count", { count: props.list.result().totalItems })}>
              {props.list.result().totalItems}
            </span>
          </div>
          <LibrarySearch
            label={t("voices.search")}
            value={props.list.search()}
            onInput={(value) => {
              preview.stop();
              props.list.changeSearch(value);
            }}
          />
        </header>
        <Show when={preview.error()}><p class="voices-playback-error" role="alert">{t("voices.previewError")}</p></Show>
        <Show
          when={props.list.result().items.length > 0}
          fallback={<p class="library-empty">{t(props.list.loading() ? "library.loading" : props.list.search().trim() ? "library.noMatches" : "voices.empty")}</p>}
        >
          <ul class="library-list">
            <For each={props.list.result().items} keyed={(voice) => voice.sha256}>
              {(voice) => (
                <Show when={voice().audio}>
                  {(audio) => (
                    <VoiceRow
                      voice={voice()}
                      audio={audio()}
                      active={props.activeVoiceHash === voice().sha256}
                      playing={preview.playing() === voice().sha256}
                      onPreview={(src) => void preview.play(voice().sha256, src)}
                      onUse={() => props.onUse(voice())}
                      onEdit={() => openModal(voice())}
                      onDelete={() => {
                        const { sha256, fileName } = voice();
                        setPendingDeletion({ sha256, fileName });
                      }}
                    />
                  )}
                </Show>
              )}
            </For>
            <li class="voices-add-row">
              <button type="button" class="btn btn-ghost" onClick={() => openModal()}>
                <TbOutlinePlus size={17} />
                {t("voices.add")}
              </button>
            </li>
          </ul>
        </Show>
        <Show when={props.list.result().totalMatches > props.list.result().pageSize}>
          <div class="library-pagination">
            <TablePagination
              page={props.list.result().page}
              pageSize={props.list.result().pageSize}
              totalItems={props.list.result().totalMatches}
              onPageChange={(page) => {
                preview.stop();
                props.list.changePage(page);
              }}
            />
          </div>
        </Show>
      </section>

      <RefVoiceModal
        open={uploadOpen()}
        initialFile={editingFile()}
        initialPath={editing()?.filePath ?? ""}
        initialTranscript={editing()?.transcript ?? ""}
        initialSha256={editing()?.sha256 ?? null}
        droppedFile={droppedFile()}
        onClose={() => {
          setUploadOpen(false);
          setEditing(null);
          setDroppedFile(null);
        }}
        onApply={props.onSaved}
      />
      <GeneralConfirmModal
        open={pendingDeletion() !== null}
        heading={t("confirm.deleteVoice")}
        message={t("confirm.voiceMessage", { name: pendingDeletion()?.fileName ?? "" })}
        confirmLabel={t("history.delete")}
        onCancel={() => setPendingDeletion(null)}
        onConfirm={() => {
          const target = pendingDeletion();
          if (!target) return;
          setPendingDeletion(null);
          if (preview.playing() === target.sha256) preview.stop();
          props.onDelete(target.sha256);
        }}
      />
    </div>
  );
}
