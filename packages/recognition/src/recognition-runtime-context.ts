import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

const structuralMasksByWall = new WeakMap<RecognitionWallCandidate, StructuralMaskView>();

function matchingDimensions(
  mask: StructuralMaskView,
  widthPx: number,
  heightPx: number,
): boolean {
  return mask.widthPx === widthPx && mask.heightPx === heightPx;
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
