type OggCodec = "opus" | "vorbis";

export async function encodeOgg(input: Blob, codec: OggCodec, signal?: AbortSignal): Promise<Blob> {
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
        worker.postMessage({ bytes, codec }, [bytes]);
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
