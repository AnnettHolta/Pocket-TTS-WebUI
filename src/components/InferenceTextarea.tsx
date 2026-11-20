import { Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import "./InferenceTextarea.css";

export interface InferenceTextareaProps {
  value: string;
  onInput: (value: string) => void;
  footer?: JSX.Element;
}

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

      <Show when={props.footer}>
        {(footer) => <div class="textarea-footer">{footer()}</div>}
      </Show>
    </section>
  );
}
