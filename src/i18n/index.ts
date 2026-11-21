import { createMemo, createSignal } from "solid-js";
import * as i18n from "@solid-primitives/i18n";
import { DICTIONARIES, LOCALE_OPTIONS, type Locale } from "./locales";

const STORAGE_KEY = "pocket-tts-locale";

function isSupportedLocale(value: string): value is Locale {
  return value === "en" || value === "uk" || value === "pl" || value === "de" || value === "zh";
}

function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isSupportedLocale(saved)) return saved;
  } catch {
    // Ignore storage access errors.
  }

  const navLang = (navigator.language || "en").toLowerCase().split("-")[0];
  return isSupportedLocale(navLang) ? navLang : "en";
}

const [locale, setLocaleSignal] = createSignal<Locale>(detectInitialLocale());
document.documentElement.lang = locale();

export function setLocale(next: Locale): void {
  setLocaleSignal(next);
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage access errors.
  }
}

const flatDict = createMemo(() => i18n.flatten(DICTIONARIES[locale()]));

export const t = i18n.translator(flatDict, i18n.resolveTemplate);

export { locale, LOCALE_OPTIONS, type Locale };

