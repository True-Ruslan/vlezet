import { reconsolidateDoorHostResiduals } from "./door-host-residual-reconsolidation";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import {
  rescaleRecognitionPixelEvidence as rescaleRecognitionPixelEvidenceBase,
} from "./source-scale";

export function rescaleRecognitionPixelEvidence(input: Readonly<{
  walls: readonly RecognitionWallCandidate[];
  openings: readonly RecognitionOpeningCandidate[];
  analysisWidthPx: number;
  analysisHeightPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
}>): Readonly<{ walls: RecognitionWallCandidate[]; openings: RecognitionOpeningCandidate[] }> {
  const reconsolidated = reconsolidateDoorHostResiduals({
    widthPx: input.analysisWidthPx,
    heightPx: input.analysisHeightPx,
    wallCandidates: input.walls,
    openings: input.openings,
  });
  return rescaleRecognitionPixelEvidenceBase({
    ...input,
    walls: reconsolidated.walls,
    openings: reconsolidated.openings,
  });
}
