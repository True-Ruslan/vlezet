import type { RecognitionDraft } from "./model";
import {
  createRejectedOpeningEvidenceTransfer,
  type RecognitionAiRejectedOpeningEvidenceTransfer,
} from "./ai-rejected-opening-evidence";
import { peekPendingAiOpeningRejectionsForWalls } from "./recognition-runtime-context";

export type MaterializePendingAiRejectedOpeningEvidenceInput = Readonly<{
  localDraft: RecognitionDraft;
  analysisWidthPx: number;
  analysisHeightPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
}>;

export function materializePendingAiRejectedOpeningEvidenceForDraft(
  input: MaterializePendingAiRejectedOpeningEvidenceInput,
): RecognitionAiRejectedOpeningEvidenceTransfer {
  const activeWallIds = input.localDraft.walls
    .filter(({ conflict }) => conflict === null)
    .map(({ id }) => id);
  return createRejectedOpeningEvidenceTransfer({
    localDraft: input.localDraft,
    rejections: peekPendingAiOpeningRejectionsForWalls(activeWallIds),
    analysisWidthPx: input.analysisWidthPx,
    analysisHeightPx: input.analysisHeightPx,
    sourceWidthPx: input.sourceWidthPx,
    sourceHeightPx: input.sourceHeightPx,
  });
}
