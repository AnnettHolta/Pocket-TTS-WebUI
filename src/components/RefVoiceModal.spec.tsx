import { render } from "@solidjs/web";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import RefVoiceModal from "./RefVoiceModal";

const mockSaveVoiceTranscript = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/oggAudio", () => ({
  encodeOgg: vi.fn(async () => new Blob(["OggS"], { type: "audio/ogg" })),
}));

vi.mock("../lib/historyDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/historyDb")>();
  return {
    ...actual,
    computeFileSha256: vi.fn().mockResolvedValue("deadbeef12345678"),
    getVoiceTranscript: vi.fn().mockResolvedValue(null),
    saveVoiceTranscript: (...args: any[]) => mockSaveVoiceTranscript(...args),
  };
});

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

describe("RefVoiceModal", () => {
  let dispose: (() => void) | undefined;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function () {
      this.removeAttribute("open");
    };
    URL.createObjectURL ??= vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL ??= vi.fn();
  });

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("saves compressed reference audio and transcript, then applies the saved audio", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const file = new File(["wav"], "ref.wav", { type: "audio/wav" });
    const host = document.createElement("div");
    document.body.appendChild(host);

    dispose = render(
      () => (
        <RefVoiceModal
          open={true}
          initialFile={file}
          initialPath="C:\voices\ref.wav"
          initialTranscript="Initial transcript"
          initialSha256="deadbeef12345678"
          onClose={onClose}
          onApply={onApply}
        />
      ),
      host
    );

    const saveBtn = host.querySelector(".ref-modal-footer .btn-primary") as HTMLButtonElement;
    saveBtn.click();

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(mockSaveVoiceTranscript).toHaveBeenCalledWith(expect.objectContaining({
      sha256: "deadbeef12345678",
      transcript: "Initial transcript",
      audio: expect.any(Blob),
    }));
    expect(onApply).toHaveBeenCalledWith({
      file: expect.objectContaining({ name: "ref.wav", type: "audio/ogg" }),
      path: "C:\\voices\\ref.wav",
      transcript: "Initial transcript",
      sha256: "deadbeef12345678",
    });
  });
});

