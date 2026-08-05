/// <reference lib="webworker" />

import {
  materializePendingAiLocalEvidenceForDraft,
  materializePendingAiRejectedOpeningEvidenceForDraft,
  type RecognitionAiRejectedOpeningEvidenceTransfer,
} from "@vlezet/recognition";
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
    let rejectedOpeningEvidence: RecognitionAiRejectedOpeningEvidenceTransfer | null = null;
    try {
      rejectedOpeningEvidence = materializePendingAiRejectedOpeningEvidenceForDraft({
        localDraft: draft,
        analysisWidthPx: request.input.imageData.width,
        analysisHeightPx: request.input.imageData.height,
        sourceWidthPx: request.input.sourceWidthPx,
        sourceHeightPx: request.input.sourceHeightPx,
      });
    } catch {
      rejectedOpeningEvidence = null;
    }
    const evidence = materializePendingAiLocalEvidenceForDraft(
      draft,
      request.input.sourceWidthPx,
      request.input.sourceHeightPx,
    );
    const resultDraft = evidence
      ? rejectedOpeningEvidence
        ? draft
        : {
            ...draft,
            diagnostics: [
              ...draft.diagnostics,
              {
                code: "ai-rejected-opening-evidence-unavailable",
                severity: "warning" as const,
                message: "Отклонённые локальные гипотезы проёмов не прошли безопасную подготовку. AI-поиск пропущенных дверей и окон останется заблокированным для этого запуска.",
                candidateId: null,
              },
            ],
          }
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
    post({
      type: "result",
      requestId: request.requestId,
      draft: resultDraft,
      evidence,
      rejectedOpeningEvidence: evidence ? rejectedOpeningEvidence : null,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Не удалось выполнить локальное распознавание.";
    post({ type: "error", requestId: request.requestId, message });
  }
};

export {};
