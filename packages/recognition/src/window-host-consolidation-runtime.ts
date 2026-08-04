import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import {
  consolidateWindowHostWalls as consolidateWindowHostWallsBase,
} from "./window-host-consolidation";
import { extendOneSidedWindowHosts } from "./window-host-one-sided-extension";

export type WindowHostConsolidationInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  structuralMask?: StructuralMaskView | null;
}>;

export type WindowHostConsolidationResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  acceptedBridgeCount: number;
  diagnostics: readonly string[];
}>;

export function consolidateWindowHostWalls(
  input: WindowHostConsolidationInput,
): WindowHostConsolidationResult {
  const structuralMask = input.structuralMask ?? null;
  if (
    structuralMask
    && (
      structuralMask.widthPx !== input.widthPx
      || structuralMask.heightPx !== input.heightPx
    )
  ) {
    throw new Error("Размер structural mask должен совпадать с размером изображения.");
  }

  const extension = structuralMask
    ? extendOneSidedWindowHosts({
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        wallCandidates: input.wallCandidates,
        symbolSegments: input.symbolSegments,
        structuralMask,
      })
    : {
        walls: input.wallCandidates,
        acceptedExtensionCount: 0,
        diagnostics: [] as readonly string[],
      };
  const base = consolidateWindowHostWallsBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: extension.walls,
    symbolSegments: input.symbolSegments,
  });
  return {
    walls: base.walls,
    acceptedBridgeCount: extension.acceptedExtensionCount + base.acceptedBridgeCount,
    diagnostics: [...new Set([...extension.diagnostics, ...base.diagnostics])].sort(),
  };
}
