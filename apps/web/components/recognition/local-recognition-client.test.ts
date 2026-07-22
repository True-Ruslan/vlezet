import { describe, expect, it, vi } from "vitest";
import { runLocalRecognition, type RecognitionWorkerLike } from "./local-recognition-client";
import type { RecognitionWorkerMessage, RecognitionWorkerRequest } from "./local-recognition-types";

class FakeWorker implements RecognitionWorkerLike {
  onmessage: ((event: MessageEvent<RecognitionWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly terminate = vi.fn();
  readonly postMessage = vi.fn((request: RecognitionWorkerRequest) => {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: "progress", requestId: request.requestId, progress: { phase: "walls", progress: 0.8 } } } as MessageEvent<RecognitionWorkerMessage>);
      this.onmessage?.({ data: {
        type: "result",
        requestId: request.requestId,
        draft: {
          id: "draft-1",
          projectId: request.input.projectId,
          referenceAssetId: request.input.referenceAssetId,
          referenceRevision: request.input.referenceRevision,
          engineVersion: "1",
          status: "local-complete",
          walls: [], openings: [], roomLabels: [], diagnostics: [], decisions: {},
          source: { local: true, cloud: false },
          createdAt: request.input.now,
          updatedAt: request.input.now,
        },
      } } as MessageEvent<RecognitionWorkerMessage>);
    });
  });
}

function fakeImageData(width: number, height: number): ImageData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: "srgb" } as ImageData;
}

function input() {
  return {
    imageData: fakeImageData(2, 2),
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    now: "2026-07-22T00:00:00.000Z",
  };
}

describe("local recognition client", () => {
  it("propagates progress, validates result and terminates the worker", async () => {
    const worker = new FakeWorker();
    const progress = vi.fn();
    const draft = await runLocalRecognition(input(), { workerFactory: () => worker, onProgress: progress });
    expect(draft.projectId).toBe("project-1");
    expect(progress).toHaveBeenCalledWith({ phase: "walls", progress: 0.8 });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates worker when aborted", async () => {
    const worker = new FakeWorker();
    worker.postMessage.mockImplementation(() => undefined);
    const controller = new AbortController();
    const promise = runLocalRecognition(input(), { workerFactory: () => worker, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects malformed worker results", async () => {
    const worker = new FakeWorker();
    worker.postMessage.mockImplementation((request: RecognitionWorkerRequest) => {
      queueMicrotask(() => worker.onmessage?.({ data: { type: "result", requestId: request.requestId, draft: { nope: true } } } as unknown as MessageEvent<RecognitionWorkerMessage>));
    });
    await expect(runLocalRecognition(input(), { workerFactory: () => worker })).rejects.toThrow(/некорректный черновик/i);
  });
});
