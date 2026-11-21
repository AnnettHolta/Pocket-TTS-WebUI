import { createEffect, createSignal, Show } from "solid-js";
import { t } from "../i18n";
import AudioPlayer from "./AudioPlayer";

export default function StoredAudio(props: { audio: Blob; name: string }) {
  const [url, setUrl] = createSignal("");
  createEffect(
    () => props.audio,
    (audio) => {
      const objectUrl = URL.createObjectURL(audio);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  );

  return (
    <Show when={url()}>
      {(src) => (
        <AudioPlayer src={src()} downloadName={props.name} downloadLabel={t("player.downloadOgg")} heading={props.name} />
      )}
    </Show>
  );
}
