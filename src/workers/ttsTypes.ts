import type { PrecisionMode } from "../lib/historyDb";

export interface SynthesizePayload {
  jobId: string;
  clientId: string;
  text: string;
  languageId: string;
  precision: PrecisionMode;
  temperature: number;
  refAudio24k?: Float32Array;
}

export type WorkerInboundMessage =
  | { type: "synthesize"; payload: SynthesizePayload }
  | { type: "cancel"; jobId: string; clientId: string }
  | { type: "ping" };

export interface QueueSnapshot {
  activeJobId: string | null;
  activeClientId: string | null;
  queuedJobIds: string[];
  queueLength: number;
}

export type WorkerOutboundMessage =
  | { type: "queue"; snapshot: QueueSnapshot }
  | {
      type: "progress";
      jobId: string;
      clientId: string;
      stage: string;
      progress: number;
    }
  | {
      type: "result";
      jobId: string;
      clientId: string;
      wavBuffer: ArrayBuffer;
      durationSec: number;
      elapsedMs: number;
      provider: string;
    }
  | {
      type: "error";
      jobId: string;
      clientId: string;
      message: string;
    };
