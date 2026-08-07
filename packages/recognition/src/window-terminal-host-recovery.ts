import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { WindowHostProposalEvidence } from "./window-host-consolidation";

export type WindowTerminalHostRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredHosts: readonly RecognitionWallCandidate[];
  recoveredHostCount: number;
  proposalEvidence: readonly WindowHostProposalEvidence[];
  diagnostics: readonly string[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type WallGeometry = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  thicknessPx: number;
}>;
type ProjectedRail = Readonly<{
  start: number;
  end: number;
  across: number;
  length: number;
}>;
type RailPair = Readonly<{
  start: number;
  end: number;
  widthPx: number;
  separationPx: number;
  centerAcrossPx: number;
}>;
type TerminalProposal = Readonly<{
  source: WallGeometry;
  anchor: WallGeometry;
  side: "start" | "end";
  endpoint: Point;
  direction: Point;
  intersection: Point;
  extensionLengthPx: number;
  railPair: RailPair;
}>;

const MAX_WALL_CANDIDATES = 64;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_RECOVERED_HOSTS = 8;
const MIN_SOURCE_LENGTH_PX = 80;
const MIN_ANCHOR_LENGTH_PX = 80;
const MIN_EXTENSION_LENGTH_PX = 72;
const MAX_EXTENSION_LENGTH_PX = 240;
const MIN_PERPENDICULAR_ANGLE_DELTA_DEG = 70;
const MAX_RAIL_ANGLE_DELTA_DEG = 8;
const MIN_WINDOW_WIDTH_PX = 30;
const MAX_WINDOW_WIDTH_PX = 240;
const MIN_EVIDENCE_MARGIN_PX = 18;
const MIN_BLOCKER_MARGIN_PX = 12;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function add(first: Point, second: Point): Point {
  return { x: first.x + second.x, y: first.y + second.y };
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function scale(point: Point, amount: number): Point {
  return { x: point.x * amount, y: point.y * amount };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function cross(first: Point, second: Point): number {
  return first.x * second.y - first.y * second.x;
}

function vectorLength(point: Point): number {
  return Math.hypot(point.x, point.y);
}

function segmentAngle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pixelPoint(
  candidate: RecognitionWallCandidate,
  endpoint: "start" | "end",
  widthPx: number,
  heightPx: number,
): Point {
  const point = candidate[endpoint];
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function wallGeometry(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): WallGeometry | null {
  const start = pixelPoint(candidate, "start", widthPx, heightPx);
  const end = pixelPoint(candidate, "end", widthPx, heightPx);
  const vector = subtract(end, start);
  const lengthPx = vectorLength(vector);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: segmentAngle(start, end),
    thicknessPx: clamp(candidate.estimatedThicknessPx ?? 20, 3, 160),
  };
}

function raySegmentIntersection(
  origin: Point,
  direction: Point,
  start: Point,
  end: Point,
): Readonly<{ along: number; ratio: number; point: Point }> | null {
  const segment = subtract(end, start);
  const denominator = cross(direction, segment);
  if (Math.abs(denominator) <= EPSILON) return null;
  const relative = subtract(start, origin);
  const along = cross(relative, segment) / denominator;
  const ratio = cross(relative, direction) / denominator;
  if (!Number.isFinite(along) || !Number.isFinite(ratio)) return null;
  return { along, ratio, point: add(origin, scale(direction, along)) };
}

function mergeRails(
  rails: readonly ProjectedRail[],
  acrossTolerancePx: number,
  gapTolerancePx: number,
): ProjectedRail[] {
  const pending = [...rails].sort((first, second) =>
    first.across - second.across || first.start - second.start || first.end - second.end);
  const merged: Array<{ start: number; end: number; weightedAcross: number; weight: number }> = [];
  for (const rail of pending) {
    const target = merged.find((candidate) => {
      const across = candidate.weightedAcross / candidate.weight;
      return Math.abs(across - rail.across) <= acrossTolerancePx
        && rail.start <= candidate.end + gapTolerancePx
        && rail.end >= candidate.start - gapTolerancePx;
    });
    if (!target) {
      merged.push({
        start: rail.start,
        end: rail.end,
        weightedAcross: rail.across * rail.length,
        weight: rail.length,
      });
      continue;
    }
    target.start = Math.min(target.start, rail.start);
    target.end = Math.max(target.end, rail.end);
    target.weightedAcross += rail.across * rail.length;
    target.weight += rail.length;
  }
  return merged.map((rail) => ({
    start: rail.start,
    end: rail.end,
    across: rail.weightedAcross / rail.weight,
    length: rail.end - rail.start,
  })).sort((first, second) =>
    first.start - second.start || first.end - second.end || first.across - second.across);
}

function terminalRailPair(
  proposal: Omit<TerminalProposal, "railPair">,
  symbolSegments: readonly DetectedLineSegment[],
): RailPair | null {
  const sourceAngle = proposal.source.angleDeg;
  const halfThickness = proposal.source.thicknessPx / 2;
  const rawRails: ProjectedRail[] = [];
  for (const segment of symbolSegments) {
    const start = { x: segment.x1, y: segment.y1 };
    const end = { x: segment.x2, y: segment.y2 };
    const lengthPx = vectorLength(subtract(end, start));
    if (!Number.isFinite(lengthPx) || lengthPx < 10 || lengthPx > MAX_WINDOW_WIDTH_PX + 80) continue;
    if (angleDelta(segmentAngle(start, end), sourceAngle) > MAX_RAIL_ANGLE_DELTA_DEG) continue;

    const startRelative = subtract(start, proposal.endpoint);
    const endRelative = subtract(end, proposal.endpoint);
    const startAlong = dot(startRelative, proposal.direction);
    const endAlong = dot(endRelative, proposal.direction);
    const intervalStart = Math.max(0, Math.min(startAlong, endAlong));
    const intervalEnd = Math.min(proposal.extensionLengthPx, Math.max(startAlong, endAlong));
    if (intervalEnd - intervalStart < 10) continue;
    const midpoint = scale(add(start, end), 0.5);
    const across = dot(subtract(midpoint, proposal.endpoint), proposal.source.normal);
    if (Math.abs(across) > Math.max(8, halfThickness * 0.8)) continue;
    rawRails.push({
      start: intervalStart,
      end: intervalEnd,
      across,
      length: intervalEnd - intervalStart,
    });
  }

  const rails = mergeRails(
    rawRails,
    Math.max(1.5, halfThickness * 0.12),
    Math.max(20, Math.min(32, halfThickness * 2.5)),
  );
  const pairs: RailPair[] = [];
  for (let firstIndex = 0; firstIndex < rails.length; firstIndex += 1) {
    const first = rails[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < rails.length; secondIndex += 1) {
      const second = rails[secondIndex]!;
      const firstCenter = (first.start + first.end) / 2;
      const secondCenter = (second.start + second.end) / 2;
      if (Math.abs(firstCenter - secondCenter) > 14) continue;
      if (Math.abs(first.start - second.start) > 18 || Math.abs(first.end - second.end) > 18) continue;
      const separationPx = Math.abs(first.across - second.across);
      if (separationPx < Math.max(3, halfThickness * 0.3)) continue;
      if (separationPx > Math.max(14, halfThickness * 1.6)) continue;
      const centerAcrossPx = (first.across + second.across) / 2;
      if (Math.abs(centerAcrossPx) > Math.max(3, halfThickness * 0.35)) continue;
      const lengthRatio = Math.min(first.length, second.length) / Math.max(first.length, second.length);
      if (lengthRatio < 0.75) continue;

      const start = Math.max(first.start, second.start);
      const end = Math.min(first.end, second.end);
      const widthPx = end - start;
      if (widthPx < MIN_WINDOW_WIDTH_PX || widthPx > MAX_WINDOW_WIDTH_PX) continue;
      if (
        start < MIN_EVIDENCE_MARGIN_PX
        || proposal.extensionLengthPx - end < MIN_EVIDENCE_MARGIN_PX
      ) continue;
      pairs.push({ start, end, widthPx, separationPx, centerAcrossPx });
    }
  }
  return pairs.sort((first, second) =>
    second.widthPx - first.widthPx
    || Math.abs(first.centerAcrossPx) - Math.abs(second.centerAcrossPx)
    || first.separationPx - second.separationPx
    || first.start - second.start)[0] ?? null;
}

function hasInteriorBlocker(
  proposal: Omit<TerminalProposal, "railPair">,
  walls: readonly WallGeometry[],
): boolean {
  return walls.some((wall) => {
    if (wall.candidate.id === proposal.source.candidate.id || wall.candidate.id === proposal.anchor.candidate.id) {
      return false;
    }
    if (wall.candidate.conflict !== null) return false;
    const intersection = raySegmentIntersection(
      proposal.endpoint,
      proposal.direction,
      wall.start,
      wall.end,
    );
    if (!intersection || intersection.ratio < -0.02 || intersection.ratio > 1.02) return false;
    return intersection.along > MIN_BLOCKER_MARGIN_PX
      && intersection.along < proposal.extensionLengthPx - MIN_BLOCKER_MARGIN_PX;
  });
}

function terminalProposals(
  walls: readonly WallGeometry[],
  symbolSegments: readonly DetectedLineSegment[],
): TerminalProposal[] {
  const proposals: TerminalProposal[] = [];
  for (const source of walls) {
    if (source.candidate.conflict !== null || source.lengthPx < MIN_SOURCE_LENGTH_PX) continue;
    for (const side of ["start", "end"] as const) {
      const endpoint = side === "start" ? source.start : source.end;
      const direction = side === "start" ? scale(source.tangent, -1) : source.tangent;
      const anchors = walls.flatMap((anchor) => {
        if (
          anchor.candidate.id === source.candidate.id
          || anchor.candidate.conflict !== null
          || anchor.lengthPx < MIN_ANCHOR_LENGTH_PX
          || angleDelta(source.angleDeg, anchor.angleDeg) < MIN_PERPENDICULAR_ANGLE_DELTA_DEG
        ) return [];
        const intersection = raySegmentIntersection(endpoint, direction, anchor.start, anchor.end);
        if (
          !intersection
          || intersection.along < MIN_EXTENSION_LENGTH_PX
          || intersection.along > MAX_EXTENSION_LENGTH_PX
          || intersection.ratio < -0.02
          || intersection.ratio > 1.02
        ) return [];
        return [{ anchor, intersection }];
      }).sort((first, second) =>
        first.intersection.along - second.intersection.along
        || first.anchor.candidate.id.localeCompare(second.anchor.candidate.id));
      const nearest = anchors[0];
      if (!nearest) continue;
      const partial: Omit<TerminalProposal, "railPair"> = {
        source,
        anchor: nearest.anchor,
        side,
        endpoint,
        direction,
        intersection: nearest.intersection.point,
        extensionLengthPx: nearest.intersection.along,
      };
      if (hasInteriorBlocker(partial, walls)) continue;
      const railPair = terminalRailPair(partial, symbolSegments);
      if (!railPair) continue;
      proposals.push({ ...partial, railPair });
    }
  }
  return proposals.sort((first, second) =>
    first.source.candidate.id.localeCompare(second.source.candidate.id)
    || first.side.localeCompare(second.side)
    || first.anchor.candidate.id.localeCompare(second.anchor.candidate.id));
}

function recoveredId(proposal: TerminalProposal): string {
  return `local-window-terminal-${proposal.source.candidate.id}--${proposal.anchor.candidate.id}-${proposal.side}`;
}

function recoveredThickness(proposal: TerminalProposal): number {
  return Math.min(
    proposal.source.thicknessPx,
    Math.max(6, proposal.railPair.separationPx * 1.5),
  );
}

function recoveredCandidate(
  proposal: TerminalProposal,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const start = proposal.side === "start" ? proposal.intersection : proposal.endpoint;
  const end = proposal.side === "start" ? proposal.endpoint : proposal.intersection;
  return {
    id: recoveredId(proposal),
    start: { x: clamp(start.x / widthPx, 0, 1), y: clamp(start.y / heightPx, 0, 1) },
    end: { x: clamp(end.x / widthPx, 0, 1), y: clamp(end.y / heightPx, 0, 1) },
    estimatedThicknessPx: recoveredThickness(proposal),
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.76, Math.max(proposal.source.candidate.evidence.localScore ?? 0.7, 0.72)),
      cloudScore: null,
      reasons: [...new Set([
        ...proposal.source.candidate.evidence.reasons,
        "paired-window-rails",
        "perpendicular-structural-anchor",
        "window-symbol-host-bridge",
        "window-terminal-host-extension",
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

function proposalEvidence(
  proposal: TerminalProposal,
  candidate: RecognitionWallCandidate,
): WindowHostProposalEvidence {
  const gapStart = add(proposal.endpoint, scale(proposal.direction, proposal.railPair.start));
  const gapEnd = add(proposal.endpoint, scale(proposal.direction, proposal.railPair.end));
  const gapCenter = scale(add(gapStart, gapEnd), 0.5);
  const generatedStart = proposal.side === "start" ? proposal.intersection : proposal.endpoint;
  const generatedEnd = proposal.side === "start" ? proposal.endpoint : proposal.intersection;
  return {
    sourceWallCandidateIds: [proposal.source.candidate.id, proposal.anchor.candidate.id],
    bridgeKind: "symbol",
    openingEligible: true,
    gap: {
      start: gapStart,
      end: gapEnd,
      center: gapCenter,
      widthPx: proposal.railPair.widthPx,
      orientationDeg: proposal.source.angleDeg,
    },
    generatedHost: {
      candidateId: candidate.id,
      start: generatedStart,
      end: generatedEnd,
    },
  };
}

export function recoverWindowTerminalHosts(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
}>): WindowTerminalHostRecoveryResult {
  if (!Number.isFinite(input.widthPx) || input.widthPx <= 0 || !Number.isFinite(input.heightPx) || input.heightPx <= 0) {
    throw new Error("Размер изображения должен быть положительным и конечным.");
  }
  if (input.wallCandidates.length > MAX_WALL_CANDIDATES || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS) {
    return {
      walls: input.wallCandidates,
      recoveredHosts: [],
      recoveredHostCount: 0,
      proposalEvidence: [],
      diagnostics: ["window-terminal-host-budget-exceeded"],
    };
  }

  const geometries = input.wallCandidates
    .map((candidate) => wallGeometry(candidate, input.widthPx, input.heightPx))
    .filter((geometry): geometry is WallGeometry => geometry !== null);
  const proposals = terminalProposals(geometries, input.symbolSegments)
    .slice(0, MAX_RECOVERED_HOSTS);
  const recoveredHosts = proposals.map((proposal) =>
    recoveredCandidate(proposal, input.widthPx, input.heightPx));
  const evidence = proposals.map((proposal, index) =>
    proposalEvidence(proposal, recoveredHosts[index]!));
  return {
    walls: [...input.wallCandidates, ...recoveredHosts]
      .sort((first, second) => first.id.localeCompare(second.id)),
    recoveredHosts,
    recoveredHostCount: recoveredHosts.length,
    proposalEvidence: evidence,
    diagnostics: proposals.length >= MAX_RECOVERED_HOSTS
      ? ["window-terminal-host-recovery-budget-reached"]
      : [],
  };
}
