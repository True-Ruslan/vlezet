import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

const structuralMasksByWall = new WeakMap<RecognitionWallCandidate, StructuralMaskView>();
const structuralSegmentsByWall = new WeakMap<RecognitionWallCandidate, Readonly<{
  widthPx: number;
  heightPx: number;
  segments: readonly DetectedLineSegment[];
}>>();

function matchingDimensions(
  mask: StructuralMaskView,
  widthPx: number,
  heightPx: number,
): boolean {
  return mask.widthPx === widthPx && mask.heightPx === heightPx;
}

function matchingSegmentDimensions(
  context: Readonly<{ widthPx: number; heightPx: number }>,
  widthPx: number,
  heightPx: number,
): boolean {
  return context.widthPx === widthPx && context.heightPx === heightPx;
}

export function registerStructuralMaskForActiveWalls(
  wallCandidates: readonly RecognitionWallCandidate[],
  mask: StructuralMaskView,
): void {
  for (const candidate of wallCandidates) {
    if (candidate.conflict === null) structuralMasksByWall.set(candidate, mask);
  }
}

export function takeStructuralMaskForWalls(
  wallCandidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): StructuralMaskView | null {
  let resolved: StructuralMaskView | null = null;
  for (const candidate of wallCandidates) {
    const mask = structuralMasksByWall.get(candidate);
    if (mask && matchingDimensions(mask, widthPx, heightPx)) {
      resolved = mask;
      break;
    }
  }
  if (!resolved) return null;
  for (const candidate of wallCandidates) structuralMasksByWall.delete(candidate);
  return resolved;
}

export function registerStructuralSegmentsForActiveWalls(
  wallCandidates: readonly RecognitionWallCandidate[],
  segments: readonly DetectedLineSegment[],
  widthPx: number,
  heightPx: number,
): void {
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) return;
  const snapshot = segments.map((segment) => ({ ...segment }));
  const context = { widthPx, heightPx, segments: snapshot } as const;
  for (const candidate of wallCandidates) {
    if (candidate.conflict === null) structuralSegmentsByWall.set(candidate, context);
  }
}

export function takeStructuralSegmentsForWalls(
  wallCandidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): readonly DetectedLineSegment[] | null {
  let resolved: Readonly<{
    widthPx: number;
    heightPx: number;
    segments: readonly DetectedLineSegment[];
  }> | null = null;
  for (const candidate of wallCandidates) {
    const context = structuralSegmentsByWall.get(candidate);
    if (context && matchingSegmentDimensions(context, widthPx, heightPx)) {
      resolved = context;
      break;
    }
  }
  if (!resolved) return null;
  for (const candidate of wallCandidates) structuralSegmentsByWall.delete(candidate);
  return resolved.segments.map((segment) => ({ ...segment }));
}
