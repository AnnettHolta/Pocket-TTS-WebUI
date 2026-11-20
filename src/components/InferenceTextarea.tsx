import { Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { TbOutlineTypography, TbOutlineX } from "solid-icons/tb";
import { t } from "../i18n";
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
          <label class="icon-label" for="prompt">
            <TbOutlineTypography size={13} />
            <span>{t("textarea.label")}</span>
          </label>
          <span class="hint mono">{props.value.length} / 2,000</span>
        </div>

        <div class="textarea-wrap">
          <textarea
            id="prompt"
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            placeholder={t("textarea.placeholder")}
          />
          <Show when={props.value.length > 0}>
            <button
              type="button"
              class="btn btn-ghost btn-sm textarea-clear"
              title={t("textarea.clearTitle")}
              onClick={() => props.onInput("")}
            >
              <TbOutlineX size={14} />
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
