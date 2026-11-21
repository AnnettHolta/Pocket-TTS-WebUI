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
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("rejects an interrupted job and lets the next request start a fresh worker", async () => {
  vi.stubGlobal("SharedWorker", undefined);
  vi.stubGlobal("Worker", TestWorker);
  const { getTtsClient } = await import("./ttsClient");
  const client = getTtsClient();
  const options = { text: "Hello", languageId: "english_2026-10", precision: "mixed", temperature: 0.3 } as const;
  const signal = new AbortController().signal;

  const interrupted = client.synthesize(options, vi.fn(), signal);
  const rejected = expect(interrupted).rejects.toThrow("speech worker stopped");
  const first = TestWorker.workers[0];
  first.onerror?.();
  await rejected;
  expect(first.terminate).toHaveBeenCalledOnce();

  const retried = client.synthesize(options, vi.fn(), signal);
  const worker = TestWorker.workers[1];
  const job = worker.messages[0];
  if (job?.type !== "synthesize") throw new Error("The new worker did not receive a synthesis job.");
  worker.onmessage?.({
    data: {
      type: "result",
      clientId: job.payload.clientId,
      jobId: job.payload.jobId,
      wavBuffer: new ArrayBuffer(4),
      durationSec: 1,
      elapsedMs: 1,
      provider: "wasm",
    },
  });
  await expect(retried).resolves.toMatchObject({ provider: "wasm", durationSec: 1 });
});
