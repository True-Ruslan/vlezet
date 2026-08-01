/// <reference lib="webworker" />

import type { RecognitionWorkerMessage, RecognitionWorkerRequest } from "./local-recognition-types";
import { runLocalRecognitionEngine } from "./local-recognition-engine";

const context: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

function post(message: RecognitionWorkerMessage): void {
  context.postMessage(message);
}

context.onmessage = async (event: MessageEvent<RecognitionWorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== "recognize") return;
  try {
    const draft = await runLocalRecognitionEngine(request.input, {
      onProgress: (progress) => post({ type: "progress", requestId: request.requestId, progress }),
    });
    post({ type: "result", requestId: request.requestId, draft });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Не удалось выполнить локальное распознавание.";
    post({ type: "error", requestId: request.requestId, message });
  }
};

export {};
