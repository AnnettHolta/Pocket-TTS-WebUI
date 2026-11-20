/**
 * Creates a lightweight 24 kHz mono PCM WAV Blob for UI previewing
 * before the ONNX WebGPU worker is connected.
 */
export function createPreviewWavBlob(durationSec = 2.4): Blob {
  const sampleRate = 24000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope =
      Math.min(1, t / 0.08) *
      Math.min(1, (durationSec - t) / 0.25) *
      (0.55 + 0.45 * Math.sin(2 * Math.PI * 2.2 * t));
    const wave =
      0.5 * Math.sin(2 * Math.PI * 220 * t) +
      0.3 * Math.sin(2 * Math.PI * 330 * t) +
      0.2 * Math.sin(2 * Math.PI * 440 * t);
    const sample = Math.max(-1, Math.min(1, wave * envelope * 0.35));
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

