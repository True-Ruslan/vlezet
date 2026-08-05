/// <reference lib="webworker" />

import { materializePendingAiLocalEvidenceForDraft } from "@vlezet/recognition";
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
    const evidence = materializePendingAiLocalEvidenceForDraft(
      draft,
      request.input.sourceWidthPx,
      request.input.sourceHeightPx,
    );
    const resultDraft = evidence
      ? draft
      : {
          ...draft,
          diagnostics: [
            ...draft.diagnostics,
            {
              code: "ai-local-evidence-unavailable",
              severity: "warning" as const,
              message: "Локальный evidence snapshot не сформирован из-за безопасного лимита или отсутствия структурной маски. AI-поиск пропусков будет недоступен до нового локального распознавания.",
              candidateId: null,
            },
          ],
        };
    post({ type: "result", requestId: request.requestId, draft: resultDraft, evidence });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Не удалось выполнить локальное распознавание.";
    post({ type: "error", requestId: request.requestId, message });
  }
};

export {};
