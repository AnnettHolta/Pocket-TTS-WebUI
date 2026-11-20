import { For } from "solid-js";
import type { PrecisionMode } from "../lib/historyDb";
import "./InferenceSettings.css";

export interface LanguageOption {
  id: string;
  label: string;
  cached: boolean;
}

export interface InferenceSettingsProps {
  languages: LanguageOption[];
  selectedLang: string;
  onSelectLang: (id: string) => void;
  precision: PrecisionMode;
  onSelectPrecision: (mode: PrecisionMode) => void;
  temperature: number;
  onChangeTemperature: (value: number) => void;
}

export default function InferenceSettings(props: InferenceSettingsProps) {
  return (
    <section class="inference-settings">
      <div class="row">
        <div class="field">
          <label for="language">Language Model</label>
          <select
            id="language"
            value={props.selectedLang}
            onChange={(e) => props.onSelectLang(e.currentTarget.value)}
          >
            <For each={props.languages}>
              {(lang) => <option value={lang.id}>{lang.label}</option>}
            </For>
          </select>
        </div>

        <div class="field">
          <label for="precision">Quantization</label>
          <select
            id="precision"
            value={props.precision}
            onChange={(e) =>
              props.onSelectPrecision(e.currentTarget.value as PrecisionMode)
            }
          >
            <option value="mixed">Mixed (INT8 main + FP32 flow/decoder)</option>
            <option value="int8">Full INT8 (Compact)</option>
          </select>
        </div>
      </div>

      <div class="field">
        <div class="field-header">
          <label for="temperature">Temperature</label>
          <span class="pill-value">{props.temperature.toFixed(2)}</span>
        </div>
        <input
          id="temperature"
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={props.temperature}
          onInput={(e) => props.onChangeTemperature(parseFloat(e.currentTarget.value))}
        />
      </div>
    </section>
  );
}
