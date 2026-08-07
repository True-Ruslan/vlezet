import {
  analyzeWallCandidates as analyzeWallCandidatesBase,
} from "./local-lines";
import type { BuildWallCandidatesInput } from "./local-lines";
import { registerStructuralSegmentsForActiveWalls } from "./recognition-runtime-context";

export function analyzeWallCandidates(input: BuildWallCandidatesInput): ReturnType<typeof analyzeWallCandidatesBase> {
  const analysis = analyzeWallCandidatesBase(input);
  registerStructuralSegmentsForActiveWalls(
    analysis.candidates,
    input.segments,
    input.widthPx,
    input.heightPx,
  );
  return analysis;
}
