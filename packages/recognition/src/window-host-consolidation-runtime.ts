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
import { recoverWindowHostSegmentedWalls } from "./window-host-segmented-recovery-runtime";
import {
  recoverWindowTerminalHosts,
  type WindowTerminalHostRecoveryResult,
} from "./window-terminal-host-recovery";

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

const MIN_TERMINAL_SOURCE_THICKNESS_PX = 8;
const MIN_EXISTING_CONTINUATION_OVERLAP_PX = 24;
const MAX_CONTINUATION_ANGLE_DELTA_DEG = 8;

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

function pixelPoint(
  point: Readonly<{ x: number; y: number }>,
  widthPx: number,
  heightPx: number,
): Readonly<{ x: number; y: number }> {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function angleDeg(
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function substantialCollinearContinuation(
  evidence: WindowHostProposalEvidence,
  source: RecognitionWallCandidate,
  candidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): boolean {
  const sourceStart = pixelPoint(source.start, widthPx, heightPx);
  const sourceEnd = pixelPoint(source.end, widthPx, heightPx);
  const sourceVector = { x: sourceEnd.x - sourceStart.x, y: sourceEnd.y - sourceStart.y };
  const sourceLength = Math.hypot(sourceVector.x, sourceVector.y);
  if (sourceLength <= Number.EPSILON) return true;
  const tangent = { x: sourceVector.x / sourceLength, y: sourceVector.y / sourceLength };
  const normal = { x: -tangent.y, y: tangent.x };
  const sourceAngle = angleDeg(sourceStart, sourceEnd);
  const generatedStart = evidence.generatedHost.start;
  const generatedEnd = evidence.generatedHost.end;
  const generatedVector = {
    x: generatedEnd.x - generatedStart.x,
    y: generatedEnd.y - generatedStart.y,
  };
  const generatedLength = Math.hypot(generatedVector.x, generatedVector.y);
  if (generatedLength <= Number.EPSILON) return true;
  const generatedTangent = {
    x: generatedVector.x / generatedLength,
    y: generatedVector.y / generatedLength,
  };
  const excluded = new Set(evidence.sourceWallCandidateIds);
  const axisTolerancePx = Math.max(6, (source.estimatedThicknessPx ?? 20) * 0.5);
  const overlapThresholdPx = Math.max(
    MIN_EXISTING_CONTINUATION_OVERLAP_PX,
    (source.estimatedThicknessPx ?? 20) * 1.25,
  );

  return candidates.some((candidate) => {
    if (candidate.conflict !== null || excluded.has(candidate.id)) return false;
    const start = pixelPoint(candidate.start, widthPx, heightPx);
    const end = pixelPoint(candidate.end, widthPx, heightPx);
    if (angleDelta(sourceAngle, angleDeg(start, end)) > MAX_CONTINUATION_ANGLE_DELTA_DEG) return false;
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const axisDistance = Math.abs(
      (midpoint.x - sourceStart.x) * normal.x + (midpoint.y - sourceStart.y) * normal.y,
    );
    if (axisDistance > axisTolerancePx) return false;
    const startProjection = (start.x - generatedStart.x) * generatedTangent.x
      + (start.y - generatedStart.y) * generatedTangent.y;
    const endProjection = (end.x - generatedStart.x) * generatedTangent.x
      + (end.y - generatedStart.y) * generatedTangent.y;
    const overlapStart = Math.max(0, Math.min(startProjection, endProjection));
    const overlapEnd = Math.min(generatedLength, Math.max(startProjection, endProjection));
    return overlapEnd - overlapStart >= overlapThresholdPx;
  });
}

function filterTerminalRecovery(
  result: WindowTerminalHostRecoveryResult,
  input: WindowHostConsolidationInput,
): WindowTerminalHostRecoveryResult {
  if (result.proposalEvidence.length === 0) {
    return { ...result, walls: input.wallCandidates };
  }
  const byId = new Map(input.wallCandidates.map((candidate) => [candidate.id, candidate]));
  const acceptedEvidence: WindowHostProposalEvidence[] = [];
  const diagnostics = [...result.diagnostics];
  for (const evidence of result.proposalEvidence) {
    const source = byId.get(evidence.sourceWallCandidateIds[0]);
    if (!source || (source.estimatedThicknessPx ?? 0) < MIN_TERMINAL_SOURCE_THICKNESS_PX) {
      diagnostics.push("window-terminal-host-weak-source-rejected");
      continue;
    }
    if (substantialCollinearContinuation(
      evidence,
      source,
      input.wallCandidates,
      input.widthPx,
      input.heightPx,
    )) {
      diagnostics.push("window-terminal-host-existing-continuation-rejected");
      continue;
    }
    acceptedEvidence.push(evidence);
  }
  const acceptedIds = new Set(acceptedEvidence.map((evidence) => evidence.generatedHost.candidateId));
  const recoveredHosts = result.recoveredHosts
    .filter((candidate) => acceptedIds.has(candidate.id))
    .sort((first, second) => first.id.localeCompare(second.id));
  return {
    walls: [...input.wallCandidates, ...recoveredHosts],
    recoveredHosts,
    recoveredHostCount: recoveredHosts.length,
    proposalEvidence: acceptedEvidence,
    diagnostics: [...new Set(diagnostics)].sort(),
  };
}

function annotateTerminalResult(
  walls: readonly RecognitionWallCandidate[],
  evidence: readonly WindowHostProposalEvidence[],
): readonly WindowHostAnnotatedWallCandidate[] {
  const directById = new Map(evidence.map((item) => [item.generatedHost.candidateId, item]));
  return walls.map((candidate): WindowHostAnnotatedWallCandidate => {
    const direct = directById.get(candidate.id);
    if (!direct) return candidate;
    return {
      ...candidate,
      windowHostProposalEvidence: direct,
      windowHostProposalEvidenceList: mergeEvidence(
        windowHostProposalEvidenceListForWall(candidate),
        [direct],
      ),
    };
  });
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

function baseInput(
  input: WindowHostConsolidationInput,
  wallCandidates: readonly RecognitionWallCandidate[] = input.wallCandidates,
): BaseWindowHostConsolidationInput {
  return {
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates,
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
  const terminal = filterTerminalRecovery(recoverWindowTerminalHosts(baseInput(input)), input);
  const terminalWalls = annotateTerminalResult(terminal.walls, terminal.proposalEvidence);
  const firstBase = consolidateWindowHostWallsBase(baseInput(input, terminalWalls));
  const firstWalls = annotateResult(firstBase, terminalWalls);
  const firstEvidence = mergeEvidence(terminal.proposalEvidence, firstBase.proposalEvidence);
  const firstDiagnostics = mergeDiagnostics(terminal.diagnostics, firstBase.diagnostics);
  const firstAcceptedBridgeCount = terminal.recoveredHostCount + firstBase.acceptedBridgeCount;

  if (!structuralMask || firstEvidence.length === 0) {
    return {
      ...firstBase,
      walls: firstWalls,
      acceptedBridgeCount: firstAcceptedBridgeCount,
      proposalEvidence: firstEvidence,
      diagnostics: firstDiagnostics,
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
      acceptedBridgeCount: firstAcceptedBridgeCount,
      proposalEvidence: firstEvidence,
      diagnostics: firstDiagnostics,
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
    acceptedBridgeCount: firstAcceptedBridgeCount + secondBase.acceptedBridgeCount,
    proposalEvidence: mergeEvidence(firstEvidence, secondBase.proposalEvidence),
    diagnostics: mergeDiagnostics(firstDiagnostics, secondBase.diagnostics),
    segmentedRecoveredWallCount: segmented.recoveredWalls.length,
  };
}
