/**
 * Parses a NumPy .npy (v1.0 / v2.0) little-endian float32 array.
 */
export function parseNpyFloat32(buffer: ArrayBuffer): {
  data: Float32Array;
  shape: number[];
} {
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(...bytes.slice(0, 6));
  if (magic !== "\x93NUMPY") {
    throw new Error("Invalid .npy file header");
  }

  const major = bytes[6];
  const view = new DataView(buffer);
  let headerLen: number;
  let headerStart: number;

  if (major === 1) {
    headerLen = view.getUint16(8, true);
    headerStart = 10;
  } else if (major === 2 || major === 3) {
    headerLen = view.getUint32(8, true);
    headerStart = 12;
  } else {
    throw new Error(`Unsupported .npy version ${major}`);
  }

  const headerText = new TextDecoder().decode(
    bytes.slice(headerStart, headerStart + headerLen)
  );
  const shapeMatch = headerText.match(/'shape'\s*:\s*\(([^)]*)\)/);
  const shape = shapeMatch
    ? shapeMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number.parseInt(s, 10))
    : [];

  const dataOffset = headerStart + headerLen;
  const data = new Float32Array(buffer.slice(dataOffset));
  return { data, shape };
}

/**
 * Encodes mono Float32 PCM (-1..1) into a 16-bit PCM RIFF/WAVE ArrayBuffer.
 */
export function encodeWav(samples: Float32Array, sampleRate = 24000): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped * 0x7fff, true);
  }

  return buffer;
}

interface SpPiece {
  id: number;
  piece: string;
  score: number;
  type: number;
}

/**
 * Lightweight pure-JS SentencePiece Unigram tokenizer reading `tokenizer.model`.
 */
export class SentencePieceTokenizer {
  private readonly piecesByText = new Map<string, SpPiece>();
  private readonly unkId: number;
  private readonly maxPieceLen: number;

  private constructor(pieces: SpPiece[]) {
    let unk = 0;
    let maxLen = 1;
    for (const p of pieces) {
      if (p.type === 2) unk = p.id;
      this.piecesByText.set(p.piece, p);
      if (p.piece.length > maxLen) maxLen = p.piece.length;
    }
    this.unkId = unk;
    this.maxPieceLen = maxLen;
  }

  static fromModelBuffer(buffer: ArrayBuffer): SentencePieceTokenizer {
    const bytes = new Uint8Array(buffer);
    const pieces: SpPiece[] = [];
    let pos = 0;

    const readVarint = (): number => {
      let result = 0;
      let shift = 0;
      while (pos < bytes.length) {
        const b = bytes[pos++];
        result |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      return result >>> 0;
    };

    const skipField = (wireType: number) => {
      if (wireType === 0) {
        readVarint();
      } else if (wireType === 1) {
        pos += 8;
      } else if (wireType === 2) {
        const len = readVarint();
        pos += len;
      } else if (wireType === 5) {
        pos += 4;
      } else {
        throw new Error(`Unsupported protobuf wireType ${wireType}`);
      }
    };

    const decoder = new TextDecoder();
    const view = new DataView(buffer);

    while (pos < bytes.length) {
      const tag = readVarint();
      const field = tag >>> 3;
      const wireType = tag & 0x07;

      if (field === 1 && wireType === 2) {
        const len = readVarint();
        const end = pos + len;
        let piece = "";
        let score = 0;
        let type = 1;

        while (pos < end) {
          const pTag = readVarint();
          const pField = pTag >>> 3;
          const pWire = pTag & 0x07;
          if (pField === 1 && pWire === 2) {
            const sLen = readVarint();
            piece = decoder.decode(bytes.slice(pos, pos + sLen));
            pos += sLen;
          } else if (pField === 2 && pWire === 5) {
            score = view.getFloat32(pos, true);
            pos += 4;
          } else if (pField === 3 && pWire === 0) {
            type = readVarint();
          } else {
            skipField(pWire);
          }
        }
        pieces.push({ id: pieces.length, piece, score, type });
      } else {
        skipField(wireType);
      }
    }

    return new SentencePieceTokenizer(pieces);
  }

  encode(text: string): number[] {
    const normalized = "\u2581" + text.trim().replace(/\s+/g, "\u2581");
    const n = normalized.length;
    if (n === 0) return [];

    const bestScore = new Float64Array(n + 1).fill(-Infinity);
    const bestPrev = new Int32Array(n + 1).fill(-1);
    const bestId = new Int32Array(n + 1).fill(this.unkId);
    bestScore[0] = 0;

    for (let i = 0; i < n; i++) {
      if (bestScore[i] === -Infinity) continue;
      const maxEnd = Math.min(n, i + this.maxPieceLen);
      let matched = false;
      for (let j = i + 1; j <= maxEnd; j++) {
        const sub = normalized.slice(i, j);
        const found = this.piecesByText.get(sub);
        if (found) {
          matched = true;
          const candidate = bestScore[i] + found.score;
          if (candidate > bestScore[j]) {
            bestScore[j] = candidate;
            bestPrev[j] = i;
            bestId[j] = found.id;
          }
        }
      }
      if (!matched) {
        const candidate = bestScore[i] - 100;
        if (candidate > bestScore[i + 1]) {
          bestScore[i + 1] = candidate;
          bestPrev[i + 1] = i;
          bestId[i + 1] = this.unkId;
        }
      }
    }

    const ids: number[] = [];
    let cur = n;
    while (cur > 0) {
      ids.push(bestId[cur]);
      cur = bestPrev[cur];
    }
    ids.reverse();
    return ids;
  }
}

