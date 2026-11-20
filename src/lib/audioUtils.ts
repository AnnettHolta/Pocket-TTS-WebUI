/**
 * Decodes an uploaded audio File (WAV/FLAC/etc.) on the main thread
 * and resamples it to 24 kHz mono Float32 PCM for Mimi encoder conditioning.
 */
export async function decodeAndResampleTo24kMono(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const targetRate = 24000;
    const targetLength = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, targetLength, targetRate);

    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    await audioCtx.close();
  }
}

