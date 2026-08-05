import type { RecognitionWallCandidate } from "./model";
import { takeStructuralMaskForWalls } from "./recognition-runtime-context";
import type { StructuralMaskView } from "./wall-completion";
import type {
  WindowHostConsolidationInput as BaseWindowHostConsolidationInput,
  WindowHostConsolidationResult as BaseWindowHostConsolidationResult,
  WindowHostProposalEvidence,
} from "./window-host-consolidation";
import {
  consolidateWindowHostWalls as consolidateWindowHostWallsBase,
} from "./window-host-consolidation";
import { recoverWindowHostSegmentedWalls } from "./window-host-segmented-recovery";

export type { WindowHostProposalEvidence } from "./window-host-consolidation";

export type WindowHostConsolidationInput = BaseWindowHostConsolidationInput & Readonly<{
  structuralMask?: StructuralMaskView;
}>;

export type WindowHostAnnotatedWallCandidate = RecognitionWallCandidate & Readonly<{
  windowHostProposalEvidence?: WindowHostProposalEvidence;
  windowHostProposalEvidenceList?: readonly WindowHostProposalEvidence[];
}>;

export type WindowHostConsolidationResult = Omit<BaseWindowHostConsolidationResult, "walls"> & Readonly<{
  walls: readonly WindowHostAnnotatedWallCandidate[];
  segmentedRecoveredWallCount: number;
}>;

function evidenceKey(evidence: WindowHostProposalEvidence): string {
  return [
    evidence.generatedHost.candidateId,
    Math.round(evidence.gap.center.x * 1000),
    Math.round(evidence.gap.center.y * 1000),
    Math.round(evidence.gap.widthPx * 1000),
  ].join("|");
}

function mergeEvidence(
  ...groups: readonly (readonly WindowHostProposalEvidence[])[]
): readonly WindowHostProposalEvidence[] {
  const byKey = new Map<string, WindowHostProposalEvidence>();
  for (const group of groups) {
    for (const evidence of group) byKey.set(evidenceKey(evidence), evidence);
  }
  return [...byKey.values()].sort((first, second) =>
    first.generatedHost.candidateId.localeCompare(second.generatedHost.candidateId)
    || first.gap.center.x - second.gap.center.x
    || first.gap.center.y - second.gap.center.y);
}

function mergeDiagnostics(...groups: readonly (readonly string[])[]): readonly string[] {
  return [...new Set(groups.flat())].sort((first, second) => first.localeCompare(second));
}

export function windowHostProposalEvidenceForWall(
  candidate: RecognitionWallCandidate,
): WindowHostProposalEvidence | null {
  const annotated = candidate as WindowHostAnnotatedWallCandidate;
  return annotated.windowHostProposalEvidence ?? null;
}

export function windowHostProposalEvidenceListForWall(
  candidate: RecognitionWallCandidate,
): readonly WindowHostProposalEvidence[] {
  const annotated = candidate as WindowHostAnnotatedWallCandidate;
  if (annotated.windowHostProposalEvidenceList) return annotated.windowHostProposalEvidenceList;
  return annotated.windowHostProposalEvidence ? [annotated.windowHostProposalEvidence] : [];
}

function annotateResult(
  base: BaseWindowHostConsolidationResult,
  inputWalls: readonly RecognitionWallCandidate[],
): readonly WindowHostAnnotatedWallCandidate[] {
  const lineageByCandidateId = new Map<string, readonly WindowHostProposalEvidence[]>();
  for (const candidate of inputWalls) {
    const inherited = windowHostProposalEvidenceListForWall(candidate);
    if (inherited.length > 0) lineageByCandidateId.set(candidate.id, inherited);
  }

  for (const evidence of base.proposalEvidence) {
    const inherited = mergeEvidence(
      lineageByCandidateId.get(evidence.sourceWallCandidateIds[0]) ?? [],
      lineageByCandidateId.get(evidence.sourceWallCandidateIds[1]) ?? [],
      [evidence],
    );
    const generatedId = evidence.generatedHost.candidateId;
    lineageByCandidateId.set(generatedId, inherited);
    lineageByCandidateId.set(`${generatedId}-residual-before`, inherited);
    lineageByCandidateId.set(`${generatedId}-residual-after`, inherited);
  }

  return base.walls.map((candidate): WindowHostAnnotatedWallCandidate => {
    const evidenceList = lineageByCandidateId.get(candidate.id) ?? [];
    if (evidenceList.length === 0) return candidate;
    const directEvidence = [...evidenceList]
      .reverse()
      .find((evidence) => evidence.generatedHost.candidateId === candidate.id);
    return {
      ...candidate,
      ...(directEvidence ? { windowHostProposalEvidence: directEvidence } : {}),
      windowHostProposalEvidenceList: evidenceList,
    };
  });
}

function baseInput(input: WindowHostConsolidationInput): BaseWindowHostConsolidationInput {
  return {
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    symbolSegments: input.symbolSegments,
  };
}

export function consolidateWindowHostWalls(
  input: WindowHostConsolidationInput,
): WindowHostConsolidationResult {
  const structuralMask = input.structuralMask ?? takeStructuralMaskForWalls(
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  );
  const firstBase = consolidateWindowHostWallsBase(baseInput(input));
  const firstWalls = annotateResult(firstBase, input.wallCandidates);
  if (!structuralMask || firstBase.proposalEvidence.length === 0) {
    return {
      ...firstBase,
      walls: firstWalls,
      segmentedRecoveredWallCount: 0,
    };
  }

  const segmented = recoverWindowHostSegmentedWalls({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: firstWalls,
    mask: structuralMask,
  });
  if (segmented.recoveredWalls.length === 0) {
    return {
      ...firstBase,
      walls: firstWalls,
      segmentedRecoveredWallCount: 0,
    };
  }

  const secondBase = consolidateWindowHostWallsBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: segmented.walls,
    symbolSegments: input.symbolSegments,
  });
  const secondWalls = annotateResult(secondBase, segmented.walls);
  return {
    walls: secondWalls,
    acceptedBridgeCount: firstBase.acceptedBridgeCount + secondBase.acceptedBridgeCount,
    proposalEvidence: mergeEvidence(firstBase.proposalEvidence, secondBase.proposalEvidence),
    diagnostics: mergeDiagnostics(firstBase.diagnostics, secondBase.diagnostics),
    segmentedRecoveredWallCount: segmented.recoveredWalls.length,
  };
}
