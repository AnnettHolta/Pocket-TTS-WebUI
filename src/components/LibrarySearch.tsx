import { t } from "../i18n";
import "./LibrarySearch.css";

export default function LibrarySearch(props: {
  label: string;
  value: string;
  onInput: (text: string) => void;
}) {
  return (
    <input
      class="library-search"
      type="search"
      aria-label={props.label}
      placeholder={t("library.search")}
      value={props.value}
      onInput={(event) => props.onInput(event.currentTarget.value)}
    />
  );
}
