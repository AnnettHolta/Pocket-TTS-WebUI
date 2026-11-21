import { createSignal, For, onCleanup, Show } from "solid-js";
import { TbOutlineDownload } from "solid-icons/tb";
import { t } from "../i18n";
import { encodeAudio } from "../lib/oggAudio";

const formats = ["ogg", "opus", "mp3", "wav", "flac"] as const;
type DownloadFormat = typeof formats[number];

export default function AudioDownload(props: { wav: Blob; url: string; oggUrl?: string; name: string }) {
  const [selectedFormat, setFormat] = createSignal<DownloadFormat>();
  const format = () => selectedFormat() ?? (props.oggUrl ? "ogg" : "wav");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let active: AbortController | undefined;
  onCleanup(() => active?.abort());
  const filename = () => `${props.name.replace(/\.ogg$/, "")}.${format()}`;
  const readyUrl = () => {
    const selected = format();
    if (selected === "wav") return props.url;
    if (selected === "ogg" || selected === "opus") return props.oggUrl;
  };

  const download = async () => {
    const selected = format();
    if (busy() || (selected !== "mp3" && selected !== "flac")) return;
    const name = filename();
    const controller = new AbortController();
    const { signal } = controller;
    active = controller;
    setBusy(true);
    setError("");

    try {
      const audio = await encodeAudio(props.wav, selected, { signal });
      signal.throwIfAborted();

      const url = URL.createObjectURL(audio);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      active = undefined;
      if (!signal.aborted) setBusy(false);
    }
  };

  return (
    <div class="audio-download">
      <div class="audio-download-actions">
        <Show when={readyUrl()} fallback={
          <button type="button" class="btn btn-secondary btn-sm" disabled={busy()} onClick={() => void download()}>
            <TbOutlineDownload size={13} />
            {t(busy() ? "studio.compressing" : "player.download")}
          </button>
        }>
          {(url) => (
            <a class="btn btn-secondary btn-sm" href={url()} download={filename()}>
              <TbOutlineDownload size={13} />
              {t(format() === "ogg" ? "player.downloadOgg" : format() === "wav" ? "player.downloadWav" : "player.download")}
            </a>
          )}
        </Show>
        <select
          aria-label={t("player.downloadFormat")}
          value={format()}
          disabled={busy()}
          onChange={(event) => {
            setFormat(event.currentTarget.value as DownloadFormat);
            setError("");
          }}
        >
          <For each={formats}>
            {(option) => (
              <option value={option} disabled={!props.oggUrl && (option === "ogg" || option === "opus")}>
                {option.toUpperCase()}
              </option>
            )}
          </For>
        </select>
      </div>
      <Show when={error()}>{(message) => <p class="audio-download-error" role="alert">{message()}</p>}</Show>
    </div>
  );
}
