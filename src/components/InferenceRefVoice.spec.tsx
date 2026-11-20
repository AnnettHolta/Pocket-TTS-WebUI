import { render } from "@solidjs/web";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import InferenceRefVoice from "./InferenceRefVoice";

vi.mock("wavesurfer.js", () => ({
  default: {
    create: () => ({
      on: vi.fn(),
      setVolume: vi.fn(),
      setPlaybackRate: vi.fn(),
      playPause: vi.fn(),
      destroy: vi.fn(),
    }),
  },
}));

describe("InferenceRefVoice", () => {
  let dispose: (() => void) | undefined;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function () {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("shows uploaded filename, transcript preview, and triggers clear", () => {
    const onClear = vi.fn();
    const file = new File(["wav"], "speaker.wav", { type: "audio/wav" });
    const host = document.createElement("div");
    document.body.appendChild(host);

    dispose = render(
      () => (
        <InferenceRefVoice
          voiceFile={file}
          voicePath="C:\voices\speaker.wav"
          voiceTranscript="Sample voice line"
          voiceSha256="abcdef1234567890"
          onApplyVoice={vi.fn()}
          onClear={onClear}
        />
      ),
      host
    );

    expect(host.querySelector(".ref-voice-title")?.textContent).toBe("speaker.wav");
    expect(host.querySelector(".ref-voice-transcript-preview")?.textContent).toContain(
      "Sample voice line"
    );

    const clearBtn = host.querySelector(".field-header button") as HTMLButtonElement;
    clearBtn.click();
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

