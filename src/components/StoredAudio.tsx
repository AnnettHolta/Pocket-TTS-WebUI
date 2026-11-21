import { createEffect, createSignal, Show } from "solid-js";
import { t } from "../i18n";

export default function StoredAudio(props: { audio: Blob; name: string }) {
  const [url, setUrl] = createSignal("");
  createEffect(() => props.audio, (audio) => {
    const objectUrl = URL.createObjectURL(audio);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  });

  return (
    <Show when={url()}>
      {(src) => (
        <div class="stored-audio">
          <audio controls preload="none" src={src()} aria-label={props.name} />
          <a class="btn btn-secondary btn-sm" href={src()} download={props.name}>
            {t("player.downloadOgg")}
          </a>
        </div>
      )}
    </Show>
  );
}
