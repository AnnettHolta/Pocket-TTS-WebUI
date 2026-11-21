/// <reference lib="webworker" />

import createFFmpegCore from "@ffmpeg/core";
import wasmUrl from "@ffmpeg/core/wasm?url";

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async ({ data }: MessageEvent<{ bytes: ArrayBuffer; bitrateKbps: number }>) => {
  const input = "input.audio";
  const output = "output.ogg";
  try {
    const wasmURL = new URL(wasmUrl, worker.location.href).href;
    const core = await createFFmpegCore({
      mainScriptUrlOrBlob: `#${btoa(JSON.stringify({ wasmURL }))}`,
    });
    core.FS.writeFile(input, new Uint8Array(data.bytes));
    const status = core.exec(
      "-i", input, "-map", "0:a:0", "-map_metadata", "-1", "-c:a", "libopus", "-b:a", `${data.bitrateKbps}k`, output,
    );
    if (status !== 0) throw new Error("Could not encode this audio. Check that the file is playable.");
    const bytes = core.FS.readFile(output).slice().buffer;
    worker.postMessage({ bytes }, [bytes]);
  } catch (error) {
    worker.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
