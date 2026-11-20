import { createEffect, createSignal, For, Show } from "solid-js";
import {
  TbFillPlayerPause,
  TbFillPlayerPlay,
  TbOutlineDownload,
  TbOutlineVolume,
  TbOutlineVolumeOff,
} from "solid-icons/tb";
import WaveSurfer from "wavesurfer.js";
import { t } from "../i18n";
import "./AudioPlayer.css";

export interface AudioPlayerProps {
  src: string;
  downloadName?: string;
  title?: string;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.75, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatSpeedLabel(rate: number): string {
  return Number.isInteger(rate) ? `${rate}.0x` : `${rate}x`;
}

export default function AudioPlayer(props: AudioPlayerProps) {
  let containerRef: HTMLDivElement | undefined;
  let wsInstance: WaveSurfer | undefined;
  let volumeWrapRef: HTMLDivElement | undefined;

  const [isReady, setIsReady] = createSignal(false);
  const [wavesExpanded, setWavesExpanded] = createSignal(false);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [speedIndex, setSpeedIndex] = createSignal(1);
  const [volume, setVolume] = createSignal(0.85);
  const [volumeOpen, setVolumeOpen] = createSignal(false);

  createEffect(
    () => props.src,
    (src) => {
      if (!containerRef || !src) return;

      setIsReady(false);
      setWavesExpanded(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      const ws = WaveSurfer.create({
        container: containerRef,
        waveColor: "#3f3f46",
        progressColor: "#ffffff",
        cursorColor: "transparent",
        barWidth: 2,
        barGap: 2,
        barRadius: 99,
        height: 28,
        normalize: true,
        url: src,
      });

      wsInstance = ws;

      ws.on("ready", (dur) => {
        setDuration(dur);
        setIsReady(true);
        ws.setVolume(volume());
        ws.setPlaybackRate(SPEED_OPTIONS[speedIndex()]);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setWavesExpanded(true));
        });
      });
      ws.on("timeupdate", (time) => setCurrentTime(time));
      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => setIsPlaying(false));

      return () => {
        ws.destroy();
        if (wsInstance === ws) {
          wsInstance = undefined;
        }
      };
    }
  );

  createEffect(
    () => volumeOpen(),
    (isOpen) => {
      if (!isOpen) return;
      const onPointerDown = (e: PointerEvent) => {
        if (volumeWrapRef && !volumeWrapRef.contains(e.target as Node)) {
          setVolumeOpen(false);
        }
      };
      window.addEventListener("pointerdown", onPointerDown);
      return () => window.removeEventListener("pointerdown", onPointerDown);
    }
  );

  const togglePlay = () => {
    void wsInstance?.playPause();
  };

  const cycleSpeed = () => {
    const next = (speedIndex() + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(next);
    wsInstance?.setPlaybackRate(SPEED_OPTIONS[next]);
  };

  const handleVolume = (val: number) => {
    setVolume(val);
    wsInstance?.setVolume(val);
  };

  return (
    <section class="audio-player">
      <div class="audio-player-header">
        <span class="audio-player-title">{props.title ?? t("player.recentOutput")}</span>
        <Show when={props.downloadName}>
          {(name) => (
            <a
              class="btn btn-secondary btn-sm"
              href={props.src}
              download={name()}
            >
              <TbOutlineDownload size={13} />
              <span>{t("player.downloadWav")}</span>
            </a>
          )}
        </Show>
      </div>

      <div class="audio-player-bar">
        <button
          type="button"
          class="audio-play-btn"
          disabled={!isReady()}
          onClick={togglePlay}
          aria-label={isPlaying() ? "Pause" : "Play"}
        >
          {isPlaying() ? <TbFillPlayerPause size={13} /> : <TbFillPlayerPlay size={13} />}
        </button>

        <span class="audio-time">
          {formatTime(currentTime())} / {formatTime(duration())}
        </span>

        <div class="audio-waveform">
          <div class={`audio-waveform-flat ${wavesExpanded() ? "hidden" : ""}`}>
            <For each={Array.from({ length: 120 })}>
              {() => <span class="audio-waveform-dot" />}
            </For>
          </div>
          <div
            class={`audio-waveform-canvas ${wavesExpanded() ? "expanded" : ""}`}
            ref={containerRef}
          />
        </div>

        <div class="audio-controls">
          <button
            type="button"
            class="audio-square-btn"
            onClick={cycleSpeed}
            title="Cycle playback speed (0.75x, 1.0x, 1.25x, 1.75x, 2.0x)"
            aria-label="Playback speed"
          >
            {formatSpeedLabel(SPEED_OPTIONS[speedIndex()])}
          </button>

          <div class="audio-volume-wrap" ref={volumeWrapRef}>
            <button
              type="button"
              class={`audio-square-btn ${volumeOpen() ? "active" : ""}`}
              onClick={() => setVolumeOpen((v) => !v)}
              title={`Volume: ${Math.round(volume() * 100)}%`}
              aria-label="Toggle volume slider"
              aria-expanded={volumeOpen() ? "true" : "false"}
            >
              {volume() > 0 ? <TbOutlineVolume size={15} /> : <TbOutlineVolumeOff size={15} />}
            </button>

            <Show when={volumeOpen()}>
              <div class="audio-volume-popover">
                <input
                  class="audio-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume()}
                  aria-label="Volume"
                  onInput={(e) => handleVolume(parseFloat(e.currentTarget.value))}
                />
              </div>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
}
