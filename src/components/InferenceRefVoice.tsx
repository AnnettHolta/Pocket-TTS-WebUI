import { Show } from "solid-js";
import "./InferenceRefVoice.css";

export interface InferenceRefVoiceProps {
  voiceFile: File | null;
  voicePath: string;
  onFileChange: (file: File | null, detectedPath: string) => void;
  onPathInput: (path: string) => void;
  onClear: () => void;
}

export default function InferenceRefVoice(props: InferenceRefVoiceProps) {
  const handleFileInput = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const detectedPath = file ? file.webkitRelativePath || file.name : "";
    props.onFileChange(file, detectedPath);
  };

  return (
    <section class="field inference-ref-voice">
      <div class="field-header">
        <label for="voice-file">Reference Voice (optional .wav)</label>
        <Show when={props.voiceFile || props.voicePath}>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onClick={() => props.onClear()}
          >
            Clear
          </button>
        </Show>
      </div>

      <div class="file-box">
        <input
          id="voice-file"
          type="file"
          accept="audio/wav,audio/*"
          onChange={handleFileInput}
        />
        <Show when={props.voiceFile}>
          {(file) => <span class="hint">{file().name}</span>}
        </Show>
      </div>

      <input
        type="text"
        value={props.voicePath}
        onInput={(e) => props.onPathInput(e.currentTarget.value)}
        placeholder="Original audio path (optional note, e.g. C:\voices\speaker.wav)"
      />
    </section>
  );
}
