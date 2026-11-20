import { For, Show } from "solid-js";
import "./InferenceTextarea.css";

export interface InferenceTextareaProps {
  value: string;
  onInput: (value: string) => void;
}

const TEXT_PRESETS = [
  {
    label: "Welcome Greeting",
    text: "Welcome to next-generation neural speech synthesis directly on your hardware.",
  },
  {
    label: "Podcast Intro",
    text: "In this episode, we explore on-device transformer models without any cloud latency.",
  },
  {
    label: "Storytelling Demo",
    text: "Once upon a quiet starlit ridge, a solitary beacon whispered stories to the constellations.",
  },
] as const;

export default function InferenceTextarea(props: InferenceTextareaProps) {
  return (
    <section class="subcard inference-textarea">
      <div class="field">
        <div class="field-header">
          <label for="prompt">Text to Synthesize</label>
          <span class="hint mono">{props.value.length} / 2,000</span>
        </div>

        <div class="textarea-wrap">
          <textarea
            id="prompt"
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            placeholder="Type text here to generate on-device audio..."
          />
          <Show when={props.value.length > 0}>
            <button
              type="button"
              class="btn btn-ghost btn-sm textarea-clear"
              title="Clear text"
              onClick={() => props.onInput("")}
            >
              ×
            </button>
          </Show>
        </div>
      </div>

      <div class="text-presets">
        <span class="hint">Presets:</span>
        <For each={TEXT_PRESETS}>
          {(preset) => (
            <button
              type="button"
              class="text-preset-chip"
              onClick={() => props.onInput(preset.text)}
            >
              {preset.label}
            </button>
          )}
        </For>
      </div>
    </section>
  );
}
