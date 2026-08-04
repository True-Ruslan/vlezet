import type {
  ContinuousDoorHostAnalysisInput,
  ContinuousDoorHostAnalysisResult,
} from "./continuous-door-host-analysis";
import {
  detectContinuousHostDoorOpenings as detectContinuousHostDoorOpeningsBase,
} from "./continuous-door-host-analysis";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";

const EVIDENCE_SPAN_TOLERANCE_PX = 2;
const BORDER_SYMBOL_MARGIN_PX = 2;
const MAX_LEAF_STRUCTURAL_SUPPORT_RATIO = 0.4;
const LEAF_SUPPORT_SAMPLES = 32;
const LEAF_SUPPORT_START_RATIO = 0.2;
const LEAF_SUPPORT_END_RATIO = 0.95;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function extendForEvidence(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const start = {
    x: candidate.start.x * widthPx,
    y: candidate.start.y * heightPx,
  };
  const end = {
    x: candidate.end.x * widthPx,
    y: candidate.end.y * heightPx,
  };
  const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return candidate;

  const tangent = {
    x: (end.x - start.x) / lengthPx,
    y: (end.y - start.y) / lengthPx,
  };
  const extendedStart = {
    x: clamp(start.x - tangent.x * EVIDENCE_SPAN_TOLERANCE_PX, 0, widthPx),
    y: clamp(start.y - tangent.y * EVIDENCE_SPAN_TOLERANCE_PX, 0, heightPx),
  };
  const extendedEnd = {
    x: clamp(end.x + tangent.x * EVIDENCE_SPAN_TOLERANCE_PX, 0, widthPx),
    y: clamp(end.y + tangent.y * EVIDENCE_SPAN_TOLERANCE_PX, 0, heightPx),
  };

  return {
    ...candidate,
    start: {
      x: extendedStart.x / widthPx,
      y: extendedStart.y / heightPx,
    },
    end: {
      x: extendedEnd.x / widthPx,
      y: extendedEnd.y / heightPx,
    },
  };
}

function touchesRasterBorder(
  segment: DetectedLineSegment,
  widthPx: number,
  heightPx: number,
): boolean {
  return [segment.x1, segment.x2].some((x) =>
    x <= BORDER_SYMBOL_MARGIN_PX || x >= widthPx - BORDER_SYMBOL_MARGIN_PX)
    || [segment.y1, segment.y2].some((y) =>
      y <= BORDER_SYMBOL_MARGIN_PX || y >= heightPx - BORDER_SYMBOL_MARGIN_PX);
}

function structuralSupportRatio(
  segment: DetectedLineSegment,
  input: ContinuousDoorHostAnalysisInput,
): number {
  let structural = 0;
  for (let index = 0; index < LEAF_SUPPORT_SAMPLES; index += 1) {
    const ratio = LEAF_SUPPORT_START_RATIO
      + (LEAF_SUPPORT_END_RATIO - LEAF_SUPPORT_START_RATIO)
        * (index + 0.5) / LEAF_SUPPORT_SAMPLES;
    const x = segment.x1 + (segment.x2 - segment.x1) * ratio;
    const y = segment.y1 + (segment.y2 - segment.y1) * ratio;
    if (input.mask.isStructural(Math.round(x), Math.round(y))) structural += 1;
  }
  return structural / LEAF_SUPPORT_SAMPLES;
}

function isDoorLeafCandidate(
  segment: DetectedLineSegment,
  input: ContinuousDoorHostAnalysisInput,
): boolean {
  return !touchesRasterBorder(segment, input.widthPx, input.heightPx)
    && structuralSupportRatio(segment, input) <= MAX_LEAF_STRUCTURAL_SUPPORT_RATIO;
}

export function detectContinuousHostDoorOpenings(
  input: ContinuousDoorHostAnalysisInput,
): ContinuousDoorHostAnalysisResult {
  return detectContinuousHostDoorOpeningsBase({
    ...input,
    wallCandidates: input.wallCandidates.map((candidate) =>
      extendForEvidence(candidate, input.widthPx, input.heightPx)),
    symbolSegments: input.symbolSegments.filter((segment) =>
      isDoorLeafCandidate(segment, input)),
  });
}
