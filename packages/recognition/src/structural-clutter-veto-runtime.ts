import type { RecognitionDiagnostic } from "./model";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery";
import {
  applyStructuralClutterVeto as applyStructuralClutterVetoBase,
  type StructuralClutterVetoResult,
} from "./structural-clutter-veto";
import { extendOneSidedWindowHosts } from "./window-host-one-sided-extension";

type StructuralClutterVetoInput = Parameters<typeof applyStructuralClutterVetoBase>[0];

function extend(
  input: StructuralClutterVetoInput,
  wallCandidates: StructuralClutterVetoResult["walls"],
) {
  return extendOneSidedWindowHosts({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates,
    symbolSegments: input.symbolSegments,
    structuralMask: input.mask,
  });
}

export function applyStructuralClutterVeto(
  input: StructuralClutterVetoInput,
): StructuralClutterVetoResult {
  const base = applyStructuralClutterVetoBase(input);
  const initialExtension = extend(input, base.walls);
  const segmented = recoverSegmentedBoundaryWalls({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: initialExtension.walls,
    mask: input.mask,
  });
  const finalExtension = extend(input, segmented.walls);
  const acceptedExtensionCount = initialExtension.acceptedExtensionCount
    + finalExtension.acceptedExtensionCount;
  if (
    segmented.recoveredWalls.length === 0
    && acceptedExtensionCount === 0
  ) return base;

  const diagnostics: RecognitionDiagnostic[] = [
    ...base.diagnostics,
    ...segmented.diagnostics,
  ];
  if (acceptedExtensionCount > 0) {
    diagnostics.push({
      code: "window-host-one-sided-extension",
      severity: "info",
      message: `По парным оконным направляющим и заполненному разделителю продлено односторонних host-стен: ${acceptedExtensionCount}.`,
      candidateId: null,
    });
  }
  return {
    walls: finalExtension.walls,
    blockedCount: base.blockedCount,
    diagnostics: diagnostics.sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
