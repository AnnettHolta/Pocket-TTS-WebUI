import { decodeAudio } from "./audioUtils";

export async function prepareReferenceAudio(input: Blob): Promise<Blob> {
  const oggHeaderSize = 27;
  const maxSegments = 255;
  const opusSignature = "OpusHead";
  const header = new Uint8Array(await input.slice(0, oggHeaderSize + maxSegments + opusSignature.length).arrayBuffer());
  // The first Ogg page starts with a segment table followed by the Opus identification packet.
  const packetOffset = oggHeaderSize + header[26];
  if (header[4] === 0 && header[5] === 2 && header[26] > 0 && header[27] >= 19
    && String.fromCharCode(...header.subarray(0, 4)) === "OggS"
    && String.fromCharCode(...header.subarray(packetOffset, packetOffset + opusSignature.length)) === opusSignature) {
    const ogg = input.slice(0, input.size, "audio/ogg");
    await decodeAudio(ogg);
    return ogg;
  }
  return encodeOggOpus(input, { bitrateKbps: 96 });
}

export async function encodeOggOpus(
  input: Blob,
  { bitrateKbps = 32, signal }: { bitrateKbps?: number; signal?: AbortSignal } = {},
): Promise<Blob> {
  const bytes = await input.arrayBuffer();
  signal?.throwIfAborted();
  const worker = new Worker(new URL("../workers/ogg.worker.ts", import.meta.url), {
    type: "module",
  });

  let abort: (() => void) | undefined;
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Audio compression timed out.")), 120_000);
      const fail = (message: string) => {
        clearTimeout(timer);
        reject(new Error(message));
      };
      abort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({ data }: MessageEvent<{ bytes: ArrayBuffer } | { error: string }>) => {
        if ("error" in data) {
          fail(data.error);
          return;
        }
        clearTimeout(timer);
        resolve(new Blob([data.bytes], { type: "audio/ogg" }));
      };
      worker.onerror = () => fail("Could not start the audio compressor.");
      worker.onmessageerror = () => fail("Could not read the compressed audio.");
      try {
        worker.postMessage({ bytes, bitrateKbps }, [bytes]);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  } finally {
    if (abort) signal?.removeEventListener("abort", abort);
    worker.terminate();
  }
}
