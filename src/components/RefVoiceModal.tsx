import { createEffect, createSignal, Show } from "solid-js";
import { TbOutlineMicrophone } from "solid-icons/tb";
import { computeFileSha256, getVoiceTranscript, saveVoiceTranscript } from "../lib/historyDb";
import AudioPlayer from "./AudioPlayer";
import Modal from "./Modal";
import "./RefVoiceModal.css";

export interface RefVoiceModalProps {
  open: boolean;
  initialFile: File | null;
  initialPath: string;
  initialTranscript: string;
  initialSha256: string | null;
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

  const revokePreview = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  createEffect(
    () => props.open,
    (isOpen) => {
      if (!isOpen) {
        revokePreview(previewUrl());
        setPreviewUrl(null);
        return;
      }
      setDraftFile(props.initialFile);
      setDraftPath(props.initialPath);
      setDraftTranscript(props.initialTranscript);
      setDraftSha256(props.initialSha256);
      setMatchedStored(false);

      if (props.initialFile) {
        setPreviewUrl(URL.createObjectURL(props.initialFile));
      } else {
        setPreviewUrl(null);
      }
    }
  );

  const processSelectedFile = async (file: File) => {
    revokePreview(previewUrl());
    setDraftFile(file);
    setDraftPath(file.webkitRelativePath || file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setMatchedStored(false);
    setIsHashing(true);

    try {
      const sha256 = await computeFileSha256(file);
      setDraftSha256(sha256);
      const stored = await getVoiceTranscript(sha256);
      if (stored) {
        setDraftTranscript(stored.transcript);
        if (stored.filePath) {
          setDraftPath(stored.filePath);
        }
        setMatchedStored(true);
      }
    } catch (err) {
      console.error("Failed to hash/lookup voice file:", err);
    } finally {
      setIsHashing(false);
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
    const sha256 = draftSha256();
    const file = draftFile();
    const path = draftPath().trim();
    const transcript = draftTranscript().trim();

    if (sha256 && file) {
      await saveVoiceTranscript({
        sha256,
        fileName: file.name,
        filePath: path || null,
        transcript,
        updatedAt: Date.now(),
      });
    }

    props.onApply({
      file,
      path,
      transcript,
      sha256,
    });
    props.onClose();
  };

  return (
    <Modal open={props.open} title="Reference Voice & Transcript" onClose={props.onClose}>
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
            <div class="ref-dropzone-icon">
              <TbOutlineMicrophone size={16} />
            </div>
            <div>
              <div class="ref-dropzone-title">
                {draftFile() ? draftFile()!.name : "Drop reference WAV/FLAC"}
              </div>
              <div class="ref-dropzone-sub">
                Audio stays in runtime memory only • Transcript saved in IndexedDB
              </div>
            </div>
          </div>

          <input
            id="ref-modal-file"
            type="file"
            accept="audio/wav,audio/flac,audio/*"
            class="ref-voice-hidden-input"
            onChange={handleFileInput}
          />
          <label for="ref-modal-file" class="btn btn-secondary btn-sm">
            Choose
          </label>
        </div>

        <Show when={isHashing() || draftSha256()}>
          <div class="ref-modal-hash-row">
            <span class="pill-value">
              {isHashing()
                ? "Computing SHA-256..."
                : `sha256: ${draftSha256()!.slice(0, 12)}…`}
            </span>
            <Show when={matchedStored()}>
              <span class="ref-modal-match">
                Matched SHA-256 — loaded stored transcript
              </span>
            </Show>
          </div>
        </Show>

        <Show when={previewUrl()}>
          {(url) => <AudioPlayer src={url()} title="Reference Audio Preview" />}
        </Show>

        <div class="field">
          <label for="ref-modal-path">Original Audio Path (optional)</label>
          <input
            id="ref-modal-path"
            type="text"
            value={draftPath()}
            onInput={(e) => setDraftPath(e.currentTarget.value)}
            placeholder="C:\voices\speaker.wav"
          />
        </div>

        <div class="field">
          <div class="field-header">
            <label for="ref-modal-transcript">Reference Transcript</label>
            <span class="hint mono">{draftTranscript().length} chars</span>
          </div>
          <textarea
            id="ref-modal-transcript"
            class="ref-modal-textarea"
            value={draftTranscript()}
            onInput={(e) => setDraftTranscript(e.currentTarget.value)}
            placeholder="Enter what is spoken in the reference audio..."
          />
        </div>

        <div class="ref-modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => props.onClose()}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={isHashing()}
            onClick={() => void handleSave()}
          >
            Save & Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}

