import type { OpeningAnalysisResult } from "./opening-analysis";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

const MIN_BOUNDARY_FALLBACK_WIDTH_TO_THICKNESS_RATIO = 2.5;

function isNarrowStructuralBoundaryFallback(
  candidate: RecognitionOpeningCandidate,
  wallsById: ReadonlyMap<string, RecognitionWallCandidate>,
): boolean {
  if (
    candidate.kind !== "window"
    || !candidate.evidence.reasons.includes("structural-network-boundary-gap")
    || candidate.evidence.reasons.includes("paired-window-rails")
  ) return false;

  const hostId = candidate.hostWallCandidateId;
  if (hostId === null) return false;
  const host = wallsById.get(hostId);
  if (!host || host.conflict !== null) return false;

  const widthPx = candidate.widthPx;
  const thicknessPx = host.estimatedThicknessPx;
  if (
    widthPx === null
    || !Number.isFinite(widthPx)
    || widthPx <= 0
    || thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
  ) return false;

  return widthPx / thicknessPx < MIN_BOUNDARY_FALLBACK_WIDTH_TO_THICKNESS_RATIO;
}

export function vetoNarrowStructuralBoundaryFallbackWindows(
  result: OpeningAnalysisResult,
  wallCandidates: readonly RecognitionWallCandidate[],
): OpeningAnalysisResult {
  const wallsById = new Map(wallCandidates.map((wall) => [wall.id, wall]));
  const candidates = result.candidates.filter((candidate) =>
    !isNarrowStructuralBoundaryFallback(candidate, wallsById));
  if (candidates.length === result.candidates.length) return result;
  return {
    candidates,
    rejections: result.rejections,
  };
}
