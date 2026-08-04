import type { RecognitionWallCandidate } from "./model";
import type {
  WindowHostConsolidationInput,
  WindowHostConsolidationResult as BaseWindowHostConsolidationResult,
} from "./window-host-consolidation";
import {
  consolidateWindowHostWalls as consolidateWindowHostWallsBase,
} from "./window-host-consolidation";

export type WindowHostProposalEvidence = Readonly<{
  sourceWallCandidateIds: readonly [string, string];
  bridgeKind: "symbol" | "boundary";
  openingEligible: boolean;
  gap: Readonly<{
    start: Readonly<{ x: number; y: number }>;
    end: Readonly<{ x: number; y: number }>;
    center: Readonly<{ x: number; y: number }>;
    widthPx: number;
    orientationDeg: number;
  }>;
  generatedHost: Readonly<{
    candidateId: string;
    start: Readonly<{ x: number; y: number }>;
    end: Readonly<{ x: number; y: number }>;
  }>;
}>;

export type WindowHostAnnotatedWallCandidate = RecognitionWallCandidate & Readonly<{
  windowHostProposalEvidence?: WindowHostProposalEvidence;
}>;

export type WindowHostConsolidationResult = Omit<BaseWindowHostConsolidationResult, "walls"> & Readonly<{
  walls: readonly WindowHostAnnotatedWallCandidate[];
  proposalEvidence: readonly WindowHostProposalEvidence[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type Geometry = Readonly<{
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
}>;

const EPSILON = 1e-7;

function pixelPoint(
  candidate: RecognitionWallCandidate,
  endpoint: "start" | "end",
  widthPx: number,
  heightPx: number,
): Point {
  const point = candidate[endpoint];
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function add(first: Point, second: Point): Point {
  return { x: first.x + second.x, y: first.y + second.y };
}

function scale(point: Point, amount: number): Point {
  return { x: point.x * amount, y: point.y * amount };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function geometry(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): Geometry | null {
  let start = pixelPoint(candidate, "start", widthPx, heightPx);
  let end = pixelPoint(candidate, "end", widthPx, heightPx);
  const rawLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(rawLength) || rawLength <= EPSILON) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
  const tangent = {
    x: (end.x - start.x) / lengthPx,
    y: (end.y - start.y) / lengthPx,
  };
  return {
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
  };
}

function generatedHostId(firstId: string, secondId: string): string {
  const [first, second] = [firstId, secondId].sort();
  return `local-window-host-${first}--${second}`;
}

function evidenceForPair(
  firstCandidate: RecognitionWallCandidate,
  secondCandidate: RecognitionWallCandidate,
  generatedHost: RecognitionWallCandidate,
  bridgeKind: "symbol" | "boundary",
  widthPx: number,
  heightPx: number,
): WindowHostProposalEvidence | null {
  const first = geometry(firstCandidate, widthPx, heightPx);
  const second = geometry(secondCandidate, widthPx, heightPx);
  const host = geometry(generatedHost, widthPx, heightPx);
  if (!first || !second || !host) return null;

  const origin = first.start;
  const tangent = first.tangent;
  const normal = first.normal;
  const firstProjected = [first.start, first.end].map((point) => dot(subtract(point, origin), tangent));
  const secondProjected = [second.start, second.end].map((point) => dot(subtract(point, origin), tangent));
  const firstInterval = {
    start: Math.min(...firstProjected),
    end: Math.max(...firstProjected),
  };
  const secondInterval = {
    start: Math.min(...secondProjected),
    end: Math.max(...secondProjected),
  };
  const left = firstInterval.start <= secondInterval.start ? firstInterval : secondInterval;
  const right = left === firstInterval ? secondInterval : firstInterval;
  const gapStartAlong = left.end;
  const gapEndAlong = right.start;
  const width = gapEndAlong - gapStartAlong;
  if (!Number.isFinite(width) || width <= EPSILON) return null;

  const firstOffset = dot(subtract(first.start, origin), normal);
  const secondOffset = dot(subtract(second.start, origin), normal);
  const lineOffset = (
    firstOffset * first.lengthPx
    + secondOffset * second.lengthPx
  ) / (first.lengthPx + second.lengthPx);
  const pointOnLine = (along: number): Point => add(
    origin,
    add(scale(tangent, along), scale(normal, lineOffset)),
  );
  const gapStart = pointOnLine(gapStartAlong);
  const gapEnd = pointOnLine(gapEndAlong);
  const gapCenter = pointOnLine((gapStartAlong + gapEndAlong) / 2);
  const orientationDeg = ((Math.atan2(tangent.y, tangent.x) * 180 / Math.PI) + 180) % 180;
  const sourceWallCandidateIds = [firstCandidate.id, secondCandidate.id].sort() as [string, string];

  return {
    sourceWallCandidateIds,
    bridgeKind,
    openingEligible: bridgeKind === "symbol",
    gap: {
      start: gapStart,
      end: gapEnd,
      center: gapCenter,
      widthPx: width,
      orientationDeg,
    },
    generatedHost: {
      candidateId: generatedHost.id,
      start: host.start,
      end: host.end,
    },
  };
}

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
  const evidence: WindowHostProposalEvidence[] = [];
  const evidenceByHostId = new Map<string, WindowHostProposalEvidence>();

  for (let firstIndex = 0; firstIndex < input.wallCandidates.length; firstIndex += 1) {
    const first = input.wallCandidates[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < input.wallCandidates.length; secondIndex += 1) {
      const second = input.wallCandidates[secondIndex]!;
      const candidateId = generatedHostId(first.id, second.id);
      const generatedHost = base.walls.find((candidate) => candidate.id === candidateId);
      if (!generatedHost) continue;
      const bridgeKind = generatedHost.evidence.reasons.includes("window-symbol-host-bridge")
        ? "symbol" as const
        : generatedHost.evidence.reasons.includes("exterior-boundary-host-bridge")
          ? "boundary" as const
          : null;
      if (!bridgeKind) continue;
      const item = evidenceForPair(
        first,
        second,
        generatedHost,
        bridgeKind,
        input.widthPx,
        input.heightPx,
      );
      if (!item) continue;
      evidence.push(item);
      evidenceByHostId.set(item.generatedHost.candidateId, item);
    }
  }

  const proposalEvidence = evidence.sort((first, second) =>
    first.generatedHost.candidateId.localeCompare(second.generatedHost.candidateId)
    || first.gap.center.x - second.gap.center.x
    || first.gap.center.y - second.gap.center.y);
  const walls = base.walls.map((candidate): WindowHostAnnotatedWallCandidate => {
    const item = evidenceByHostId.get(candidate.id);
    return item ? { ...candidate, windowHostProposalEvidence: item } : candidate;
  });

  return {
    ...base,
    walls,
    proposalEvidence,
  };
}
