import type { RecognitionWallCandidate } from "./model";
import type {
  WindowHostConsolidationInput,
  WindowHostConsolidationResult as BaseWindowHostConsolidationResult,
  WindowHostProposalEvidence,
} from "./window-host-consolidation";
import {
  consolidateWindowHostWalls as consolidateWindowHostWallsBase,
} from "./window-host-consolidation";

export type { WindowHostProposalEvidence } from "./window-host-consolidation";

export type WindowHostAnnotatedWallCandidate = RecognitionWallCandidate & Readonly<{
  windowHostProposalEvidence?: WindowHostProposalEvidence;
}>;

export type WindowHostConsolidationResult = Omit<BaseWindowHostConsolidationResult, "walls"> & Readonly<{
  walls: readonly WindowHostAnnotatedWallCandidate[];
}>;

export function windowHostProposalEvidenceForWall(
  candidate: RecognitionWallCandidate,
): WindowHostProposalEvidence | null {
  const annotated = candidate as WindowHostAnnotatedWallCandidate;
  return annotated.windowHostProposalEvidence ?? null;
}

export function consolidateWindowHostWalls(
  input: WindowHostConsolidationInput,
): WindowHostConsolidationResult {
  const base = consolidateWindowHostWallsBase(input);
  const evidenceByHostId = new Map(
    base.proposalEvidence.map((item) => [item.generatedHost.candidateId, item] as const),
  );
  const walls = base.walls.map((candidate): WindowHostAnnotatedWallCandidate => {
    const evidence = evidenceByHostId.get(candidate.id);
    return evidence ? { ...candidate, windowHostProposalEvidence: evidence } : candidate;
  });
  return { ...base, walls };
}
