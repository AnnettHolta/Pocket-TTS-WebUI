import { createSignal, onCleanup } from "solid-js";

export default function createLibraryPreview() {
  const [playing, setPlaying] = createSignal<string | null>(null);
  const [error, setError] = createSignal(false);
  let player: HTMLAudioElement | undefined;

  const stop = () => {
    player?.pause();
    player = undefined;
    setPlaying(null);
  };
  onCleanup(stop);

  const play = async (key: string, src: string) => {
    const wasPlaying = playing() === key;
    stop();
    setError(false);
    if (wasPlaying) return;

    const audio = new Audio(src);
    player = audio;
    setPlaying(key);
    const fail = () => {
      if (player !== audio) return;
      stop();
      setError(true);
    };
    audio.onended = () => { if (player === audio) stop(); };
    audio.onerror = fail;
    try {
      await audio.play();
    } catch {
      fail();
    }
  };

  return { playing, error, play, stop };
}
