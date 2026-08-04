import type {
  ContinuousDoorHostAnalysisInput,
  ContinuousDoorHostAnalysisResult,
} from "./continuous-door-host-analysis";
import {
  detectContinuousHostDoorOpenings as detectContinuousHostDoorOpeningsBase,
} from "./continuous-door-host-analysis";
import type { RecognitionWallCandidate } from "./model";

const EVIDENCE_SPAN_TOLERANCE_PX = 2;
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

export function detectContinuousHostDoorOpenings(
  input: ContinuousDoorHostAnalysisInput,
): ContinuousDoorHostAnalysisResult {
  return detectContinuousHostDoorOpeningsBase({
    ...input,
    wallCandidates: input.wallCandidates.map((candidate) =>
      extendForEvidence(candidate, input.widthPx, input.heightPx)),
  });
}
