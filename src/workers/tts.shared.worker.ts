/// <reference lib="webworker" />

import { runPocketTtsSynthesis } from "./pocketTtsEngine";
import type {
  QueueSnapshot,
  SynthesizePayload,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "./ttsTypes";

interface QueuedJob {
  payload: SynthesizePayload;
  port: MessagePort | null;
}

const connectedPorts = new Set<MessagePort>();
const jobQueue: QueuedJob[] = [];
let activeJob: QueuedJob | null = null;
let isProcessing = false;

function broadcast(msg: WorkerOutboundMessage, transfer?: Transferable[]): void {
  if (connectedPorts.size > 0) {
    for (const port of connectedPorts) {
      try {
        if (transfer && transfer.length > 0) {
          port.postMessage(msg, transfer);
        } else {
          port.postMessage(msg);
        }
      } catch {
        connectedPorts.delete(port);
      }
    }
    return;
  }

  // Dedicated Worker fallback
  if (transfer && transfer.length > 0) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);
  } else {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
  }
}

function sendToPort(
  port: MessagePort | null,
  msg: WorkerOutboundMessage,
  transfer?: Transferable[]
): void {
  if (port) {
    if (transfer && transfer.length > 0) {
      port.postMessage(msg, transfer);
    } else {
      port.postMessage(msg);
    }
    return;
  }
  broadcast(msg, transfer);
}

function emitQueueSnapshot(): void {
  const snapshot: QueueSnapshot = {
    activeJobId: activeJob?.payload.jobId ?? null,
    activeClientId: activeJob?.payload.clientId ?? null,
    queuedJobIds: jobQueue.map((j) => j.payload.jobId),
    queueLength: jobQueue.length + (activeJob ? 1 : 0),
  };
  broadcast({ type: "queue", snapshot });
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (jobQueue.length > 0) {
    const next = jobQueue.shift()!;
    activeJob = next;
    emitQueueSnapshot();

    const startedAt = performance.now();
    const { jobId, clientId, text, languageId, precision, temperature, refAudio24k } =
      next.payload;

    try {
      const result = await runPocketTtsSynthesis({
        text,
        languageId,
        precision,
        temperature,
        refAudio24k,
        onProgress: (stage, progress) => {
          sendToPort(next.port, {
            type: "progress",
            jobId,
            clientId,
            stage,
            progress,
          });
        },
      });

      const elapsedMs = Math.round(performance.now() - startedAt);
      sendToPort(
        next.port,
        {
          type: "result",
          jobId,
          clientId,
          wavBuffer: result.wavBuffer,
          durationSec: result.durationSec,
          elapsedMs,
          provider: result.provider,
        },
        [result.wavBuffer]
      );
    } catch (err) {
      sendToPort(next.port, {
        type: "error",
        jobId,
        clientId,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      activeJob = null;
      emitQueueSnapshot();
    }
  }

  isProcessing = false;
}

function handleMessage(msg: WorkerInboundMessage, port: MessagePort | null): void {
  if (msg.type === "ping") {
    emitQueueSnapshot();
    return;
  }

  if (msg.type === "cancel") {
    const idx = jobQueue.findIndex(
      (j) => j.payload.jobId === msg.jobId && j.payload.clientId === msg.clientId
    );
    if (idx !== -1) {
      jobQueue.splice(idx, 1);
      emitQueueSnapshot();
    }
    return;
  }

  if (msg.type === "synthesize") {
    jobQueue.push({ payload: msg.payload, port });
    emitQueueSnapshot();
    void processQueue();
  }
}

// SharedWorker entry
(self as unknown as SharedWorkerGlobalScope).onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  connectedPorts.add(port);

  port.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
    handleMessage(e.data, port);
  };

  port.start();
  emitQueueSnapshot();
};

// Dedicated Worker fallback entry (if SharedWorker is unsupported)
if (typeof DedicatedWorkerGlobalScope !== "undefined" && self instanceof DedicatedWorkerGlobalScope) {
  self.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
    handleMessage(e.data, null);
  };
}

