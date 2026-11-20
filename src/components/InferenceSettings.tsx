import { For } from "solid-js";
import { TbOutlineStack2, TbOutlineWorld } from "solid-icons/tb";
import { t } from "../i18n";
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

const TEMP_PRESETS = [
  { key: "settings.precise" as const, value: 0.1 },
  { key: "settings.natural" as const, value: 0.35 },
  { key: "settings.expressive" as const, value: 0.65 },
  { key: "settings.dynamic" as const, value: 0.95 },
];

export default function InferenceSettings(props: InferenceSettingsProps) {
  return (
    <section class="subcard inference-settings">
      <div class="field">
        <label class="icon-label" for="language">
          <TbOutlineWorld size={13} />
          <span>{t("settings.languageModel")}</span>
        </label>
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
        <label class="icon-label" for="precision">
          <TbOutlineStack2 size={13} />
          <span>{t("settings.quantization")}</span>
        </label>
        <select
          id="precision"
          value={props.precision}
          onChange={(e) =>
            props.onSelectPrecision(e.currentTarget.value as PrecisionMode)
          }
        >
          <option value="mixed">{t("settings.mixedOption")}</option>
          <option value="int8">{t("settings.int8Option")}</option>
        </select>
      </div>

      <div class="field">
        <div class="field-header">
          <div>
            <label for="temperature">{t("settings.temperature")}</label>{" "}
            <span class="hint">{t("settings.variation")}</span>
          </div>
          <span class="pill-value">{props.temperature.toFixed(2)}</span>
        </div>

        <input
          id="temperature"
          type="range"
          min="0.05"
          max="1.0"
          step="0.05"
          value={props.temperature}
          onInput={(e) => props.onChangeTemperature(parseFloat(e.currentTarget.value))}
        />

        <div class="temp-presets">
          <For each={TEMP_PRESETS}>
            {(preset) => (
              <button
                type="button"
                class={`temp-preset-btn ${
                  Math.abs(props.temperature - preset.value) < 0.01 ? "active" : ""
                }`}
                onClick={() => props.onChangeTemperature(preset.value)}
              >
                {t(preset.key)}
              </button>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
