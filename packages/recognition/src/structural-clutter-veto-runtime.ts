import type { RecognitionDiagnostic } from "./model";
import {
  registerStructuralMaskForActiveWalls,
  takeStructuralSegmentsForWalls,
} from "./recognition-runtime-context";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery-runtime";
import { recoverStrongMaskRotatedDoorHosts } from "./strong-mask-rotated-door-host-recovery";
import { recoverStrongMaskRotatedWalls } from "./strong-mask-rotated-wall-recovery";
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

function withRuntimeMask(
  result: StructuralClutterVetoResult,
  input: StructuralClutterVetoInput,
): StructuralClutterVetoResult {
  registerStructuralMaskForActiveWalls(result.walls, input.mask);
  return result;
}

export function applyStructuralClutterVeto(
  input: StructuralClutterVetoInput,
): StructuralClutterVetoResult {
  const structuralSegments = takeStructuralSegmentsForWalls(
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  );
  const base = applyStructuralClutterVetoBase(input);
  const rotated = structuralSegments
    ? recoverStrongMaskRotatedWalls({
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        primaryWalls: base.walls,
        segments: structuralSegments,
        mask: input.mask,
      })
    : {
        walls: base.walls,
        recoveredWalls: [],
        recoveredCount: 0,
        diagnostics: [],
      };
  const rotatedDoorHosts = structuralSegments
    ? recoverStrongMaskRotatedDoorHosts({
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        primaryWalls: rotated.walls,
        structuralSegments,
        symbolSegments: input.symbolSegments,
        mask: input.mask,
      })
    : {
        walls: rotated.walls,
        recoveredWalls: [],
        recoveredCount: 0,
        diagnostics: [],
      };
  const initialExtension = extend(input, rotatedDoorHosts.walls);
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
    rotated.recoveredCount === 0
    && rotatedDoorHosts.recoveredCount === 0
    && segmented.recoveredWalls.length === 0
    && acceptedExtensionCount === 0
  ) return withRuntimeMask(base, input);

  const diagnostics: RecognitionDiagnostic[] = [
    ...base.diagnostics,
    ...rotated.diagnostics,
    ...rotatedDoorHosts.diagnostics,
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
  return withRuntimeMask({
    walls: finalExtension.walls,
    blockedCount: base.blockedCount,
    diagnostics: diagnostics.sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  }, input);
}
