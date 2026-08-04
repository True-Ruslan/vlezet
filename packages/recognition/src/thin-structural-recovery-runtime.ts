import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery";
import type { ThinStructuralRecoveryResult } from "./thin-structural-recovery";
import {
  recoverThinStructuralWalls as recoverThinStructuralWallsBase,
} from "./thin-structural-recovery";

export function recoverThinStructuralWalls(
  input: Parameters<typeof recoverThinStructuralWallsBase>[0],
): ThinStructuralRecoveryResult {
  const base = recoverThinStructuralWallsBase(input);
  const segmented = recoverSegmentedBoundaryWalls({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: base.walls,
    mask: input.inkMask,
  });
  return {
    walls: segmented.walls,
    recoveredWalls: [
      ...base.recoveredWalls,
      ...segmented.recoveredWalls,
    ].sort((first, second) => first.id.localeCompare(second.id)),
    acceptedComponentCount: base.acceptedComponentCount + segmented.acceptedChainCount,
    dominantFrameDeg: base.dominantFrameDeg,
    diagnostics: [
      ...base.diagnostics,
      ...segmented.diagnostics,
    ].sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
