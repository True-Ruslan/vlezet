import { validateRecognitionDraft, type RecognitionDraft } from "@vlezet/recognition";
import { recognitionError, recognitionInfo } from "./recognition-debug";
import type {
  LocalRecognitionInput,
  LocalRecognitionProgress,
  MaterializedLocalRecognitionInput,
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

type ImageDataWithSourceSize = ImageData & Partial<Readonly<{
  sourceWidthPx: number;
  sourceHeightPx: number;
}>>;

function defaultWorkerFactory(): RecognitionWorkerLike {
  return new Worker(new URL("./recognition.worker.ts", import.meta.url), { type: "module" });
}

function positiveDimension(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveScale(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function materializeInput(input: LocalRecognitionInput): MaterializedLocalRecognitionInput {
  const image = input.imageData as ImageDataWithSourceSize;
  return {
    ...input,
    sourceWidthPx: positiveDimension(input.sourceWidthPx ?? image.sourceWidthPx, input.imageData.width),
    sourceHeightPx: positiveDimension(input.sourceHeightPx ?? image.sourceHeightPx, input.imageData.height),
    sourceMillimetersPerPixel: positiveScale(input.sourceMillimetersPerPixel),
  };
}

export function runLocalRecognition(
  input: LocalRecognitionInput,
  options: LocalRecognitionOptions = {},
): Promise<RecognitionDraft> {
  if (options.signal?.aborted) return Promise.reject(new DOMException("Распознавание отменено.", "AbortError"));
  const worker = (options.workerFactory ?? defaultWorkerFactory)();
  const requestId = crypto.randomUUID();
  const materialized = materializeInput(input);
  const startedAt = performance.now();

  recognitionInfo("local.start", {
    analysisWidthPx: materialized.imageData.width,
    analysisHeightPx: materialized.imageData.height,
    sourceWidthPx: materialized.sourceWidthPx,
    sourceHeightPx: materialized.sourceHeightPx,
    millimetersPerPixel: materialized.sourceMillimetersPerPixel,
  });

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
    const abort = () => {
      recognitionInfo("local.abort", { durationMs: Math.round(performance.now() - startedAt) });
      finish(() => reject(new DOMException("Распознавание отменено.", "AbortError")));
    };

    worker.onmessage = (event) => {
      const message = event.data;
      if (message.requestId !== requestId) return;
      if (message.type === "progress") {
        recognitionInfo("local.progress", { phase: message.progress.phase, progress: Math.round(message.progress.progress * 100) });
        options.onProgress?.(message.progress);
        return;
      }
      if (message.type === "error") {
        const error = new LocalRecognitionError(message.message);
        recognitionError("local.error", error, { durationMs: Math.round(performance.now() - startedAt) });
        finish(() => reject(error));
        return;
      }
      try {
        const draft = validateRecognitionDraft(message.draft);
        recognitionInfo("local.complete", {
          walls: draft.walls.length,
          openings: draft.openings.length,
          diagnostics: draft.diagnostics.length,
          durationMs: Math.round(performance.now() - startedAt),
        });
        finish(() => resolve(draft));
      } catch (cause) {
        const error = new LocalRecognitionError("Локальный движок вернул некорректный черновик.", { cause });
        recognitionError("local.invalid-result", error, { durationMs: Math.round(performance.now() - startedAt) });
        finish(() => reject(error));
      }
    };
    worker.onerror = (event) => {
      const error = new LocalRecognitionError(event.message || undefined);
      recognitionError("local.worker-error", error, { durationMs: Math.round(performance.now() - startedAt) });
      finish(() => reject(error));
    };
    options.signal?.addEventListener("abort", abort, { once: true });

    const request: RecognitionWorkerRequest = { type: "recognize", requestId, input: materialized };
    worker.postMessage(request);
  });
}
