import { afterEach, expect, it, vi } from "vitest";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "../workers/ttsTypes";

class TestWorker {
  static workers: TestWorker[] = [];
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: WorkerOutboundMessage }) => void) | null = null;
  messages: WorkerInboundMessage[] = [];
  terminate = vi.fn();

  constructor() {
    TestWorker.workers.push(this);
  }

  postMessage(message: WorkerInboundMessage) {
    this.messages.push(message);
  }
}

afterEach(() => {
  TestWorker.workers = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function getJob(worker: TestWorker) {
  const job = worker.messages.find((message) => message.type === "synthesize");
  if (!job) throw new Error("The worker did not receive a synthesis job.");
  return job.payload;
}

function completeJob(worker: TestWorker) {
  const job = getJob(worker);
  worker.onmessage?.({
    data: {
      type: "result",
      clientId: job.clientId,
      jobId: job.jobId,
      wavBuffer: new ArrayBuffer(4),
      durationSec: 1,
      elapsedMs: 1,
      provider: "wasm",
    },
  });
}

const options = { text: "Hello", languageId: "english_2026-10", precision: "mixed", temperature: 0.3 } as const;

it("rejects an interrupted job and lets the next request start a fresh worker", async () => {
  vi.stubGlobal("SharedWorker", undefined);
  vi.stubGlobal("Worker", TestWorker);
  const { getTtsClient } = await import("./ttsClient");
  const client = getTtsClient();
  const signal = new AbortController().signal;

  const interrupted = client.synthesize(options, vi.fn(), signal);
  const rejected = expect(interrupted).rejects.toThrow("speech worker stopped");
  const first = TestWorker.workers[0];
  first.onerror?.();
  await rejected;
  expect(first.terminate).toHaveBeenCalledOnce();

  const retried = client.synthesize(options, vi.fn(), signal);
  completeJob(TestWorker.workers[1]);
  await expect(retried).resolves.toMatchObject({ provider: "wasm", durationSec: 1 });
});

it("restarts on CPU after WebGPU fails and preserves the reference audio", async () => {
  vi.stubGlobal("SharedWorker", undefined);
  vi.stubGlobal("Worker", TestWorker);
  const { getTtsClient } = await import("./ttsClient");
  const client = getTtsClient();
  const reference = new Float32Array([0.5, -0.5]);
  const fallback = vi.fn();
  const signal = new AbortController().signal;
  const result = client.synthesize({ ...options, refAudio24k: reference }, vi.fn(), signal, fallback);
  const gpuWorker = TestWorker.workers[0];
  const gpuJob = getJob(gpuWorker);
  expect(gpuJob.forceCpu).toBe(false);
  expect(gpuJob.refAudio24k?.buffer).not.toBe(reference.buffer);
  gpuWorker.onmessage?.({
    data: {
      type: "error", jobId: gpuJob.jobId, clientId: gpuJob.clientId,
      message: "GPU readback failed", retryOnCpu: true,
    },
  });

  await vi.waitFor(() => expect(fallback).toHaveBeenCalledOnce());
  const cpuWorker = TestWorker.workers[1];
  expect(gpuWorker.terminate).toHaveBeenCalledOnce();
  expect(getJob(cpuWorker)).toMatchObject({ forceCpu: true, refAudio24k: reference });
  completeJob(cpuWorker);
  await expect(result).resolves.toMatchObject({ provider: "wasm" });

  const next = client.synthesize(options, vi.fn(), signal);
  const nextMessage = cpuWorker.messages.at(-1);
  if (nextMessage?.type !== "synthesize") throw new Error("CPU worker did not receive the next job.");
  expect(nextMessage.payload.forceCpu).toBe(true);
  const cancelled = expect(next).rejects.toThrow("CPU error");
  cpuWorker.onmessage?.({
    data: {
      type: "error", jobId: nextMessage.payload.jobId, clientId: nextMessage.payload.clientId,
      message: "CPU error",
    },
  });
  await cancelled;
  expect(TestWorker.workers).toHaveLength(2);
});

it("switches to a fresh worker when a GPU operation stops responding", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("SharedWorker", undefined);
  vi.stubGlobal("Worker", TestWorker);
  const { getTtsClient } = await import("./ttsClient");
  const result = getTtsClient().synthesize(options, vi.fn(), new AbortController().signal);
  const gpuWorker = TestWorker.workers[0];
  const job = getJob(gpuWorker);
  gpuWorker.onmessage?.({
    data: {
      type: "progress", jobId: job.jobId, clientId: job.clientId,
      stage: "encodingReference", progress: 0.7, webGpuOperation: true,
    },
  });

  await vi.advanceTimersByTimeAsync(45_000);
  expect(gpuWorker.messages.at(-1)).toMatchObject({ type: "cancel", jobId: job.jobId });
  expect(gpuWorker.terminate).toHaveBeenCalledOnce();
  const cpuWorker = TestWorker.workers[1];
  expect(getJob(cpuWorker).forceCpu).toBe(true);
  completeJob(cpuWorker);
  await expect(result).resolves.toMatchObject({ provider: "wasm" });
});
