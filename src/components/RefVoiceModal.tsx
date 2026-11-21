import { createEffect, createSignal, onCleanup, Show, untrack } from "solid-js";
import { TbOutlineUpload } from "solid-icons/tb";
import { t } from "../i18n";
import { computeFileSha256, getVoiceTranscript, saveVoiceTranscript } from "../lib/historyDb";
import { prepareReferenceAudio } from "../lib/oggAudio";
import AudioPlayer from "./AudioPlayer";
import Modal from "./Modal";
import "./RefVoiceModal.css";

export interface RefVoiceModalProps {
  open: boolean;
  heading?: string;
  initialFile: File | null;
  initialPath: string;
  initialTranscript: string;
  initialSha256: string | null;
  droppedFile?: File | null;
  onClose: () => void;
  onApply: (payload: {
    file: File | null;
    path: string;
    transcript: string;
    sha256: string | null;
  }) => void;
}

export default function RefVoiceModal(props: RefVoiceModalProps) {
  const [draftFile, setDraftFile] = createSignal<File | null>(null);
  const [draftPath, setDraftPath] = createSignal("");
  const [draftTranscript, setDraftTranscript] = createSignal("");
  const [draftSha256, setDraftSha256] = createSignal<string | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
  const [matchedStored, setMatchedStored] = createSignal(false);
  const [isHashing, setIsHashing] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal("");
  let selection = 0;
  let fileInput: HTMLInputElement | undefined;

  const revokePreview = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  onCleanup(() => {
    selection++;
    revokePreview(previewUrl());
  });

  createEffect(
    () => {
      if (!props.open) return null;
      // Snapshot the draft on open while lazy JSX props have a reactive owner.
      return untrack(() => ({
        file: props.initialFile,
        path: props.initialPath,
        transcript: props.initialTranscript,
        sha256: props.initialSha256,
        dropped: props.droppedFile,
      }));
    },
    (initial) => {
      if (!initial) {
        selection++;
        revokePreview(untrack(previewUrl));
        setPreviewUrl(null);
        return;
      }
      setDraftFile(initial.file);
      setDraftPath(initial.path);
      setDraftTranscript(initial.transcript);
      setDraftSha256(initial.sha256);
      setMatchedStored(false);
      setIsHashing(false);
      setErrorMessage("");

      setPreviewUrl(initial.file ? URL.createObjectURL(initial.file) : null);
      const dropped = initial.dropped;
      if (dropped) untrack(() => void processSelectedFile(dropped));
    }
  );

  const processSelectedFile = async (file: File) => {
    if (isSaving()) return;
    const current = ++selection;
    revokePreview(previewUrl());
    setDraftFile(file);
    setDraftSha256(null);
    setDraftPath(file.webkitRelativePath || file.name);
    setDraftTranscript("");
    setPreviewUrl(URL.createObjectURL(file));
    setMatchedStored(false);
    setIsHashing(true);
    setErrorMessage("");

    try {
      const sha256 = await computeFileSha256(file);
      const stored = await getVoiceTranscript(sha256);
      if (current !== selection) return;
      if (!props.initialFile && props.initialSha256 && props.initialSha256 !== sha256) {
        setErrorMessage(t("refVoice.mismatch"));
        return;
      }
      setDraftSha256(sha256);
      if (stored) {
        setDraftTranscript(stored.transcript);
        if (stored.filePath) {
          setDraftPath(stored.filePath);
        }
        setMatchedStored(true);
      } else if (!props.initialFile && props.initialSha256 === sha256) {
        setDraftTranscript(props.initialTranscript);
      }
    } catch (err) {
      if (current === selection) setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      if (current === selection) setIsHashing(false);
    }
  };

  const handleFileInput = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleSave = async () => {
    if (isSaving() || isHashing()) return;
    const sha256 = draftSha256();
    const file = draftFile();
    const path = draftPath().trim();
    const transcript = draftTranscript().trim();

    if (!sha256 || !file) return;
    const current = selection;
    setIsSaving(true);
    setErrorMessage("");

    try {
      const existing = await getVoiceTranscript(sha256);
      const audio = existing?.audio ?? await prepareReferenceAudio(file);
      if (current !== selection) return;
      await saveVoiceTranscript({
        sha256,
        fileName: file.name,
        filePath: path || null,
        transcript,
        updatedAt: Date.now(),
        audio,
      });
      if (current !== selection) return;
      props.onApply({ file: new File([audio], file.name, { type: audio.type }), path, transcript, sha256 });
      props.onClose();
    } catch (error) {
      if (current === selection) setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={props.open} heading={props.heading ?? t("refVoice.modalTitle")} onClose={props.onClose} busy={isSaving()}>
      <div class="ref-modal-body">
        <div
          class={`ref-dropzone ${isDragging() ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div class="ref-dropzone-info">
            <div class="ref-dropzone-icon" aria-hidden="true">
              <TbOutlineUpload size={17} />
            </div>
            <div class="ref-dropzone-copy">
              <div class="ref-dropzone-title">
                {draftFile() ? draftFile()!.name : t("refVoice.dropTitle")}
              </div>
              <div class="ref-dropzone-sub">{t("refVoice.dropSub")}</div>
            </div>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="audio/*,.ogg,.opus"
            hidden
            onChange={handleFileInput}
          />
          <button type="button" class="btn btn-secondary btn-sm" onClick={() => fileInput?.click()} disabled={isSaving()}>
            {t("refVoice.choose")}
          </button>
        </div>

        <Show when={isHashing() || matchedStored()}>
          <p class="ref-modal-status" role="status">
            {t(isHashing() ? "library.loading" : "refVoice.savedNotes")}
          </p>
        </Show>

        <Show when={previewUrl()}>
          {(url) => <AudioPlayer src={url()} heading={t("refVoice.previewTitle")} />}
        </Show>

        <div class="field">
          <div class="field-header">
            <label for="ref-modal-transcript">{t("refVoice.transcriptLabel")}</label>
            <span class="hint mono">
              {t("refVoice.chars", { count: draftTranscript().length })}
            </span>
          </div>
          <textarea
            id="ref-modal-transcript"
            class="ref-modal-textarea"
            value={draftTranscript()}
            onInput={(e) => setDraftTranscript(e.currentTarget.value)}
            placeholder={t("refVoice.transcriptPlaceholder")}
          />
        </div>

        <details class="ref-modal-source">
          <summary>{t("refVoice.pathLabel")}</summary>
          <input
            type="text"
            aria-label={t("refVoice.pathLabel")}
            value={draftPath()}
            onInput={(e) => setDraftPath(e.currentTarget.value)}
          />
        </details>

        <Show when={errorMessage()}>
          <p class="ref-modal-error" role="alert">{errorMessage()}</p>
        </Show>
        <div class="ref-modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            disabled={isSaving()}
            onClick={() => props.onClose()}
          >
            {t("refVoice.cancel")}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={isHashing() || isSaving() || !draftFile() || !draftSha256()}
            onClick={() => void handleSave()}
          >
            {isSaving() ? t("refVoice.saving") : t("refVoice.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

