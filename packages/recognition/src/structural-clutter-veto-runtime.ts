import type { RecognitionDiagnostic } from "./model";
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
  const extension = extendOneSidedWindowHosts({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: base.walls,
    symbolSegments: input.symbolSegments,
    structuralMask: input.mask,
  });
  if (extension.acceptedExtensionCount === 0) return base;

  const diagnostic: RecognitionDiagnostic = {
    code: "window-host-one-sided-extension",
    severity: "info",
    message: `По парным оконным направляющим и заполненному разделителю продлено односторонних host-стен: ${extension.acceptedExtensionCount}.`,
    candidateId: null,
  };
  return {
    walls: extension.walls,
    blockedCount: base.blockedCount,
    diagnostics: [...base.diagnostics, diagnostic].sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
