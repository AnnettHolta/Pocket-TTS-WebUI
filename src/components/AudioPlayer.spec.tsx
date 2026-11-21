import { flush } from "solid-js";
import { render } from "@solidjs/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import AudioPlayer from "./AudioPlayer";

const mockWs = {
  on: vi.fn((event: string, cb: (...args: any[]) => void) => {
    if (event === "ready") cb(12.4);
  }),
  setVolume: vi.fn(),
  setPlaybackRate: vi.fn(),
  playPause: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("wavesurfer.js", () => ({
  default: {
    create: vi.fn(() => mockWs),
  },
}));

describe("AudioPlayer", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("formats duration as MM:SS and cycles playback speed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => <AudioPlayer src="blob:test" downloadName="out.wav" heading="Output" />,
      host
    );

    expect(host.querySelector(".audio-time")?.textContent).toBe("00:00 / 00:12");
    const speedBtn = host.querySelector('button[aria-label="Playback speed"]') as HTMLButtonElement;
    expect(speedBtn.textContent).toBe("1.0x");

    speedBtn.click();
    flush();
    expect(speedBtn.textContent).toBe("1.25x");
    expect(mockWs.setPlaybackRate).toHaveBeenCalledWith(1.25);
  });
});
