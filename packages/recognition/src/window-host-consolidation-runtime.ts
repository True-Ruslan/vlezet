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
  windowHostProposalEvidenceList?: readonly WindowHostProposalEvidence[];
}>;

export type WindowHostConsolidationResult = Omit<BaseWindowHostConsolidationResult, "walls"> & Readonly<{
  walls: readonly WindowHostAnnotatedWallCandidate[];
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

export function consolidateWindowHostWalls(
  input: WindowHostConsolidationInput,
): WindowHostConsolidationResult {
  const base = consolidateWindowHostWallsBase(input);
  const lineageByCandidateId = new Map<string, readonly WindowHostProposalEvidence[]>();
  for (const candidate of input.wallCandidates) {
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

  const walls = base.walls.map((candidate): WindowHostAnnotatedWallCandidate => {
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
  return { ...base, walls };
}
