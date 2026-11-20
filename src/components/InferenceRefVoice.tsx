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
    <section class="subcard inference-ref-voice">
      <div class="field-header">
        <label for="voice-file">
          Voice Cloning <span class="hint">(optional)</span>
        </label>
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

      <div class="ref-voice-box">
        <div class="ref-voice-top">
          <div class="ref-voice-info">
            <div class="ref-voice-icon">WAV</div>
            <div>
              <div class="ref-voice-title">
                {props.voiceFile ? props.voiceFile.name : "Drop reference WAV/FLAC"}
              </div>
              <div class="ref-voice-sub">Mono 24kHz recommended</div>
            </div>
          </div>

          <input
            id="voice-file"
            type="file"
            accept="audio/wav,audio/flac,audio/*"
            class="ref-voice-hidden-input"
            onChange={handleFileInput}
          />
          <label for="voice-file" class="btn btn-secondary btn-sm">
            Choose
          </label>
        </div>

        <div class="ref-voice-path-row">
          <input
            type="text"
            value={props.voicePath}
            onInput={(e) => props.onPathInput(e.currentTarget.value)}
            placeholder="Path: C:\voices\speaker.wav"
          />
        </div>
      </div>
    </section>
  );
}
