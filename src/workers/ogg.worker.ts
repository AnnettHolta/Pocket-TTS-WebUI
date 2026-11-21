/// <reference lib="webworker" />

import createFFmpegCore from "@ffmpeg/core";
import wasmUrl from "@ffmpeg/core/wasm?url";
import type { AudioEncodingFormat } from "../lib/oggAudio";

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async ({ data }: MessageEvent<{ bytes: ArrayBuffer; format: AudioEncodingFormat; bitrateKbps: number }>) => {
  const input = "input.audio";
  const output = `output.${data.format}`;
  try {
    const wasmURL = new URL(wasmUrl, worker.location.href).href;
    const core = await createFFmpegCore({
      mainScriptUrlOrBlob: `#${btoa(JSON.stringify({ wasmURL }))}`,
    });
    core.FS.writeFile(input, new Uint8Array(data.bytes));
    const codecs: Record<AudioEncodingFormat, string[]> = {
      ogg: ["-c:a", "libopus", "-b:a", `${data.bitrateKbps}k`],
      mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
      flac: ["-c:a", "flac"],
    };
    const status = core.exec(
      "-i", input, "-map", "0:a:0", "-map_metadata", "-1", ...codecs[data.format], output,
    );
    if (status !== 0) throw new Error("Could not encode this audio. Check that the file is playable.");
    const bytes = core.FS.readFile(output).slice().buffer;
    worker.postMessage({ bytes }, [bytes]);
  } catch (error) {
    worker.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
