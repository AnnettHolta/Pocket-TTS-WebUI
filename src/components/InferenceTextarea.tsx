import "./InferenceTextarea.css";

export interface InferenceTextareaProps {
  value: string;
  onInput: (value: string) => void;
}

export default function InferenceTextarea(props: InferenceTextareaProps) {
  return (
    <section class="field inference-textarea">
      <div class="field-header">
        <label for="prompt">Text to Synthesize</label>
        <span class="hint">{props.value.length} chars</span>
      </div>
      <textarea
        id="prompt"
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder="Enter text to synthesize..."
      />
    </section>
  );
}
