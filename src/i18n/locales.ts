import { en, type Dictionary } from "./en";
import { uk } from "./uk";
import { pl } from "./pl";
import { de } from "./de";
import { zh } from "./zh";

export type Locale = "en" | "uk" | "pl" | "de" | "zh";

export const LOCALE_OPTIONS: ReadonlyArray<{ code: Locale; flag: string; label: string }> = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "uk", flag: "🇺🇦", label: "Українська" },
  { code: "pl", flag: "🇵🇱", label: "Polski" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
];

export { en, uk, pl, de, zh, type Dictionary };

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  uk,
  pl,
  de,
  zh,
};
