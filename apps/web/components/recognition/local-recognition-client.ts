import { validateRecognitionDraft, type RecognitionDraft } from "@vlezet/recognition";
import type {
  LocalRecognitionInput,
  LocalRecognitionProgress,
  RecognitionWorkerMessage,
  RecognitionWorkerRequest,
} from "./local-recognition-types";

export class LocalRecognitionError extends Error {
  constructor(message = "Не удалось распознать план локально.", options?: ErrorOptions) {
    super(message, options);
    this.name = "LocalRecognitionError";
  }
}

export type RecognitionWorkerLike = Pick<Worker, "postMessage" | "terminate"> & {
  onmessage: ((event: MessageEvent<RecognitionWorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type LocalRecognitionOptions = Readonly<{
  signal?: AbortSignal;
  onProgress?: (progress: LocalRecognitionProgress) => void;
  workerFactory?: () => RecognitionWorkerLike;
}>;

function defaultWorkerFactory(): RecognitionWorkerLike {
  return new Worker(new URL("./recognition.worker.ts", import.meta.url), { type: "module" });
}

export function runLocalRecognition(
  input: LocalRecognitionInput,
  options: LocalRecognitionOptions = {},
): Promise<RecognitionDraft> {
  if (options.signal?.aborted) return Promise.reject(new DOMException("Распознавание отменено.", "AbortError"));
  const worker = (options.workerFactory ?? defaultWorkerFactory)();
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      options.signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => finish(() => reject(new DOMException("Распознавание отменено.", "AbortError")));

    worker.onmessage = (event) => {
      const message = event.data;
      if (message.requestId !== requestId) return;
      if (message.type === "progress") {
        options.onProgress?.(message.progress);
        return;
      }
      if (message.type === "error") {
        finish(() => reject(new LocalRecognitionError(message.message)));
        return;
      }
      try {
        const draft = validateRecognitionDraft(message.draft);
        finish(() => resolve(draft));
      } catch (cause) {
        finish(() => reject(new LocalRecognitionError("Локальный движок вернул некорректный черновик.", { cause })));
      }
    };
    worker.onerror = (event) => {
      finish(() => reject(new LocalRecognitionError(event.message || undefined)));
    };
    options.signal?.addEventListener("abort", abort, { once: true });

    const request: RecognitionWorkerRequest = { type: "recognize", requestId, input };
    worker.postMessage(request);
  });
}
