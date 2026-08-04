import type { RecognitionOpeningCandidate } from "./model";
import type {
  DoorHostConsolidationInput,
  DoorHostConsolidationResult,
} from "./door-host-consolidation";
import {
  consolidateDoorHostWalls as consolidateDoorHostWallsBase,
} from "./door-host-consolidation";
import { createWindowHostOpeningHypotheses } from "./window-host-opening-hypotheses";
import {
  windowHostProposalEvidenceListForWall,
  type WindowHostProposalEvidence,
} from "./window-host-consolidation-runtime";

function evidenceKey(evidence: WindowHostProposalEvidence): string {
  return [
    evidence.generatedHost.candidateId,
    Math.round(evidence.gap.center.x * 1000),
    Math.round(evidence.gap.center.y * 1000),
    Math.round(evidence.gap.widthPx * 1000),
  ].join("|");
}

function collectWindowProposalEvidence(
  input: DoorHostConsolidationInput,
): readonly WindowHostProposalEvidence[] {
  const byKey = new Map<string, WindowHostProposalEvidence>();
  for (const wall of input.wallCandidates) {
    for (const evidence of windowHostProposalEvidenceListForWall(wall)) {
      byKey.set(evidenceKey(evidence), evidence);
    }
  }
  return [...byKey.values()].sort((first, second) =>
    first.generatedHost.candidateId.localeCompare(second.generatedHost.candidateId)
    || first.gap.center.x - second.gap.center.x
    || first.gap.center.y - second.gap.center.y);
}

function mergeOpeningHypotheses(
  first: readonly RecognitionOpeningCandidate[],
  second: readonly RecognitionOpeningCandidate[],
): readonly RecognitionOpeningCandidate[] {
  const byId = new Map<string, RecognitionOpeningCandidate>();
  for (const candidate of [...first, ...second]) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function consolidateDoorHostWalls(
  input: DoorHostConsolidationInput,
): DoorHostConsolidationResult {
  const windowProposalEvidence = collectWindowProposalEvidence(input);
  const windowHypotheses = createWindowHostOpeningHypotheses({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: [],
    proposalEvidence: windowProposalEvidence,
  });
  const base = consolidateDoorHostWallsBase(input);
  return {
    ...base,
    openingHypotheses: mergeOpeningHypotheses(
      base.openingHypotheses,
      windowHypotheses,
    ),
  };
}
