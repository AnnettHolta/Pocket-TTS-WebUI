import type {
  QueueSnapshot,
  SynthesizePayload,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "../workers/ttsTypes";

type ProgressHandler = (stage: string, progress: number) => void;
type QueueHandler = (snapshot: QueueSnapshot) => void;
type SynthesisOptions = Omit<SynthesizePayload, "jobId" | "clientId" | "forceCpu">;
type SynthesisResult = Extract<WorkerOutboundMessage, { type: "result" }>;

class RetryOnCpuError extends Error {}

interface PendingJob {
  receive: (message: Exclude<WorkerOutboundMessage, { type: "queue" }>) => void;
  fail: (error: Error) => void;
}

const IDLE_TIMEOUT_MS = 5 * 60_000;
const WEBGPU_IDLE_TIMEOUT_MS = 45_000;
const EMPTY_QUEUE: QueueSnapshot = {
  activeJobId: null,
  activeClientId: null,
  queuedJobIds: [],
  queueLength: 0,
};

class TtsSharedClient {
  readonly clientId = crypto.randomUUID();
  private connection: {
    post: (message: WorkerInboundMessage, transfer?: Transferable[]) => void;
    close: () => void;
  } | null = null;
  private useSharedWorker = typeof SharedWorker !== "undefined";
  private forceCpu = false;
  private pending = new Map<string, PendingJob>();
  private queueListeners = new Set<QueueHandler>();

  private connect() {
    if (this.connection) return this.connection;
    const receive = (event: MessageEvent<WorkerOutboundMessage>) => {
      const msg = event.data;
      if (msg.type === "queue") {
        this.emitQueue(msg.snapshot);
      } else if (msg.clientId === this.clientId) {
        this.pending.get(msg.jobId)?.receive(msg);
      }
    };

    if (this.useSharedWorker) {
      try {
        const worker = new SharedWorker(new URL("../workers/tts.shared.worker.ts", import.meta.url), {
          type: "module",
          name: "pocket-tts-shared-worker",
        });
        const close = () => {
          worker.onerror = null;
          worker.port.onmessage = null;
          worker.port.onmessageerror = null;
          worker.port.close();
        };
        const fail = () => {
          this.useSharedWorker = false;
          this.reset(new Error("The shared speech worker stopped. Retry to use a dedicated worker."));
        };
        worker.onerror = fail;
        worker.port.onmessage = receive;
        worker.port.onmessageerror = fail;
        worker.port.start();
        return this.connection = { post: (msg, transfer = []) => worker.port.postMessage(msg, transfer), close };
      } catch {
        this.useSharedWorker = false;
      }
    }

    const worker = new Worker(new URL("../workers/tts.shared.worker.ts", import.meta.url), { type: "module" });
    const fail = () => this.reset(new Error("The speech worker stopped. Try generating again."));
    worker.onerror = fail;
    worker.onmessageerror = fail;
    worker.onmessage = receive;
    return this.connection = {
      post: (msg, transfer = []) => worker.postMessage(msg, transfer),
      close: () => {
        worker.onerror = null;
        worker.onmessage = null;
        worker.onmessageerror = null;
        worker.terminate();
      },
    };
  }

  private emitQueue(snapshot: QueueSnapshot) {
    for (const listener of this.queueListeners) listener(snapshot);
  }

  private reset(error: Error) {
    this.connection?.close();
    this.connection = null;
    for (const job of this.pending.values()) job.fail(error);
    this.emitQueue(EMPTY_QUEUE);
  }

  subscribeQueue(listener: QueueHandler): () => void {
    this.queueListeners.add(listener);
    return () => { this.queueListeners.delete(listener); };
  }

  async synthesize(
    params: SynthesisOptions,
    onProgress: ProgressHandler,
    signal: AbortSignal,
    onCpuFallback?: () => void,
  ): Promise<SynthesisResult> {
    const forceCpu = this.forceCpu;
    try {
      return await this.runAttempt(params, onProgress, signal, forceCpu);
    } catch (error) {
      if (forceCpu || !(error instanceof RetryOnCpuError)) throw error;
      signal.throwIfAborted();
      if (!this.forceCpu) {
        this.forceCpu = true;
        this.useSharedWorker = false;
        this.reset(error);
      }
      onCpuFallback?.();
      return this.runAttempt(params, onProgress, signal, true);
    }
  }

  private runAttempt(
    params: SynthesisOptions,
    onProgress: ProgressHandler,
    signal: AbortSignal,
    forceCpu: boolean,
  ): Promise<SynthesisResult> {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const connection = this.connect();
      const jobId = crypto.randomUUID();
      // The first attempt transfers its own copy so the reference survives a retry.
      const refAudio24k = params.refAudio24k?.slice();
      const payload: SynthesizePayload = { ...params, refAudio24k, jobId, clientId: this.clientId, forceCpu };
      let idleTimer: ReturnType<typeof setTimeout>;
      const cleanup = () => {
        clearTimeout(idleTimer);
        signal.removeEventListener("abort", abort);
        this.pending.delete(jobId);
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cancel = () => {
        try {
          connection.post({ type: "cancel", jobId, clientId: this.clientId });
        } catch {
          // A dead connection is reset by its error handler or the next failed post.
        }
      };
      const abort = () => {
        cancel();
        fail(signal.reason);
      };
      const resetIdleTimer = (webGpuOperation = false) => {
        clearTimeout(idleTimer);
        const allowCpuRetry = webGpuOperation && !forceCpu;
        idleTimer = setTimeout(() => {
          cancel();
          if (allowCpuRetry) {
            fail(new RetryOnCpuError("WebGPU stopped responding."));
            return;
          }
          this.useSharedWorker = false;
          this.reset(new Error("The speech worker stopped responding. Try generating again."));
        }, allowCpuRetry ? WEBGPU_IDLE_TIMEOUT_MS : IDLE_TIMEOUT_MS);
      };
      this.pending.set(jobId, {
        fail,
        receive: (message) => {
          if (message.type === "progress") {
            resetIdleTimer(message.webGpuOperation);
            onProgress(message.stage, message.progress);
          } else if (message.type === "result") {
            cleanup();
            resolve(message);
          } else {
            fail(message.retryOnCpu ? new RetryOnCpuError(message.message) : new Error(message.message));
          }
        },
      });
      signal.addEventListener("abort", abort, { once: true });
      resetIdleTimer();
      try {
        connection.post({ type: "synthesize", payload }, refAudio24k ? [refAudio24k.buffer] : []);
      } catch (error) {
        this.useSharedWorker = false;
        this.reset(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

let singletonClient: TtsSharedClient | null = null;

export function getTtsClient(): TtsSharedClient {
  return singletonClient ??= new TtsSharedClient();
}
