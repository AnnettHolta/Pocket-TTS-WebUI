import type {
  QueueSnapshot,
  SynthesizePayload,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "../workers/ttsTypes";

export type TtsProgressHandler = (stage: string, progress: number) => void;
export type TtsQueueHandler = (snapshot: QueueSnapshot) => void;

interface PendingJob {
  resolve: (res: {
    wavBuffer: ArrayBuffer;
    durationSec: number;
    elapsedMs: number;
    provider: string;
  }) => void;
  reject: (err: Error) => void;
  onProgress?: TtsProgressHandler;
}

class TtsSharedClient {
  readonly clientId = crypto.randomUUID();
  private postFn: (msg: WorkerInboundMessage, transfer?: Transferable[]) => void;
  private pending = new Map<string, PendingJob>();
  private queueListeners = new Set<TtsQueueHandler>();

  constructor() {
    if (typeof SharedWorker !== "undefined") {
      const worker = new SharedWorker(
        new URL("../workers/tts.shared.worker.ts", import.meta.url),
        { type: "module", name: "pocket-tts-shared-worker" }
      );
      worker.port.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
        this.handleOutbound(e.data);
      };
      worker.port.start();
      this.postFn = (msg, transfer) => {
        if (transfer && transfer.length > 0) {
          worker.port.postMessage(msg, transfer);
        } else {
          worker.port.postMessage(msg);
        }
      };
    } else {
      const worker = new Worker(
        new URL("../workers/tts.shared.worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
        this.handleOutbound(e.data);
      };
      this.postFn = (msg, transfer) => {
        if (transfer && transfer.length > 0) {
          worker.postMessage(msg, transfer);
        } else {
          worker.postMessage(msg);
        }
      };
    }

    this.postFn({ type: "ping" });
  }

  subscribeQueue(listener: TtsQueueHandler): () => void {
    this.queueListeners.add(listener);
    return () => this.queueListeners.delete(listener);
  }

  synthesize(
    params: Omit<SynthesizePayload, "jobId" | "clientId">,
    onProgress?: TtsProgressHandler
  ): Promise<{
    wavBuffer: ArrayBuffer;
    durationSec: number;
    elapsedMs: number;
    provider: string;
  }> {
    const jobId = crypto.randomUUID();
    const payload: SynthesizePayload = {
      ...params,
      jobId,
      clientId: this.clientId,
    };

    const transfer: Transferable[] = [];
    if (payload.refAudio24k) {
      transfer.push(payload.refAudio24k.buffer);
    }

    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject, onProgress });
      this.postFn({ type: "synthesize", payload }, transfer);
    });
  }

  private handleOutbound(msg: WorkerOutboundMessage): void {
    if (msg.type === "queue") {
      for (const listener of this.queueListeners) {
        listener(msg.snapshot);
      }
      return;
    }

    if (msg.clientId !== this.clientId) return;
    const job = this.pending.get(msg.jobId);
    if (!job) return;

    if (msg.type === "progress") {
      job.onProgress?.(msg.stage, msg.progress);
    } else if (msg.type === "result") {
      this.pending.delete(msg.jobId);
      job.resolve({
        wavBuffer: msg.wavBuffer,
        durationSec: msg.durationSec,
        elapsedMs: msg.elapsedMs,
        provider: msg.provider,
      });
    } else if (msg.type === "error") {
      this.pending.delete(msg.jobId);
      job.reject(new Error(msg.message));
    }
  }
}

let singletonClient: TtsSharedClient | null = null;

export function getTtsClient(): TtsSharedClient {
  if (!singletonClient) {
    singletonClient = new TtsSharedClient();
  }
  return singletonClient;
}

