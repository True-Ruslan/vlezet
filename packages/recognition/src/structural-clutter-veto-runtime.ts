import type { RecognitionDiagnostic } from "./model";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery";
import {
  applyStructuralClutterVeto as applyStructuralClutterVetoBase,
  type StructuralClutterVetoResult,
} from "./structural-clutter-veto";
import { extendOneSidedWindowHosts } from "./window-host-one-sided-extension";

type StructuralClutterVetoInput = Parameters<typeof applyStructuralClutterVetoBase>[0];

export function applyStructuralClutterVeto(
  input: StructuralClutterVetoInput,
): StructuralClutterVetoResult {
  const base = applyStructuralClutterVetoBase(input);
  const segmented = recoverSegmentedBoundaryWalls({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: base.walls,
    mask: input.mask,
  });
  const extension = extendOneSidedWindowHosts({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: segmented.walls,
    symbolSegments: input.symbolSegments,
    structuralMask: input.mask,
  });
  if (
    segmented.recoveredWalls.length === 0
    && extension.acceptedExtensionCount === 0
  ) return base;

  const diagnostics: RecognitionDiagnostic[] = [
    ...base.diagnostics,
    ...segmented.diagnostics,
  ];
  if (extension.acceptedExtensionCount > 0) {
    diagnostics.push({
      code: "window-host-one-sided-extension",
      severity: "info",
      message: `По парным оконным направляющим и заполненному разделителю продлено односторонних host-стен: ${extension.acceptedExtensionCount}.`,
      candidateId: null,
    });
  }
  return {
    walls: extension.walls,
    blockedCount: base.blockedCount,
    diagnostics: diagnostics.sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
