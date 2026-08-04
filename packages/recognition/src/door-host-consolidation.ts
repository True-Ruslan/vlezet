import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import { DEFAULT_OPENING_ANALYSIS_OPTIONS } from "./opening-analysis";

export type DoorHostConsolidationInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
}>;

type Point = Readonly<{ x: number; y: number }>;

export type DoorOpeningEligibility = Readonly<{
  eligible: boolean;
  startMarginPx: number;
  endMarginPx: number;
  minimumMarginPx: number;
  reason: "generated-host-end-margin" | null;
}>;

export type DoorHostProposalEvidence = Readonly<{
  sourceWallCandidateIds: readonly [string, string];
  selectedLeaf: Readonly<{
    anchorSide: "start" | "end";
    anchor: Point;
    free: Point;
    lengthPx: number;
  }>;
  gap: Readonly<{
    start: Point;
    end: Point;
    widthPx: number;
  }>;
  generatedHost: Readonly<{
    candidateId: string;
    start: Point;
    end: Point;
  }>;
  openingEligibility: DoorOpeningEligibility;
}>;

export type DoorHostConsolidationResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  openingHypotheses: readonly RecognitionOpeningCandidate[];
  proposalEvidence: readonly DoorHostProposalEvidence[];
  acceptedBridgeCount: number;
  diagnostics: readonly string[];
}>;

type Interval = Readonly<{ start: number; end: number }>;
type WallGeometry = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  length: number;
  angleDeg: number;
  thicknessPx: number;
}>;
type ProjectedEndpoint = Readonly<{ along: number; across: number; point: Point }>;
type DoorLeafEvidence = Readonly<{
  anchorSide: "start" | "end";
  anchor: ProjectedEndpoint;
  free: ProjectedEndpoint;
  lengthPx: number;
  key: string;
}>;
type BridgeProposal = Readonly<{
  firstId: string;
  secondId: string;
  firstIndex: number;
  secondIndex: number;
  tangent: Point;
  normal: Point;
  origin: Point;
  lineOffset: number;
  unionStart: number;
  unionEnd: number;
  gapStart: number;
  gapEnd: number;
  thicknessPx: number;
  localScore: number;
  evidenceReasons: readonly string[];
  selectedLeaf: DoorLeafEvidence;
  key: string;
}>;
type PairEvaluation = Readonly<{
  proposal: BridgeProposal | null;
  diagnostics: readonly string[];
}>;
type AppliedProposal = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  openingHypothesis: RecognitionOpeningCandidate | null;
  proposalEvidence: DoorHostProposalEvidence | null;
}>;

const MAX_WALL_CANDIDATES = 64;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_ACCEPTED_BRIDGES = 16;
const MIN_FRAGMENT_LENGTH_PX = 20;
const MIN_DOOR_GAP_PX = 30;
const MAX_DOOR_GAP_PX = 240;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function stablePixelValue(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
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

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function segmentAngle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pointOnLine(origin: Point, tangent: Point, normal: Point, along: number, across: number): Point {
  return add(origin, add(scale(tangent, along), scale(normal, across)));
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

function canonicalGeometry(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): WallGeometry | null {
  let start = pixelPoint(candidate, "start", widthPx, heightPx);
  let end = pixelPoint(candidate, "end", widthPx, heightPx);
  const rawLength = distance(start, end);
  if (!Number.isFinite(rawLength) || rawLength < EPSILON) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const length = distance(start, end);
  const tangent = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    length,
    angleDeg: segmentAngle(start, end),
    thicknessPx: clamp(candidate.estimatedThicknessPx ?? 20, 3, 160),
  };
}

function projectInterval(geometry: WallGeometry, origin: Point, tangent: Point): Interval {
  const first = dot(subtract(geometry.start, origin), tangent);
  const second = dot(subtract(geometry.end, origin), tangent);
  return { start: Math.min(first, second), end: Math.max(first, second) };
}

function projectEndpoint(
  point: Point,
  proposal: Omit<BridgeProposal, "key" | "selectedLeaf">,
): ProjectedEndpoint {
  const relative = subtract(point, proposal.origin);
  return {
    along: dot(relative, proposal.tangent),
    across: dot(relative, proposal.normal) - proposal.lineOffset,
    point,
  };
}

function canonicalSegmentPoints(segment: DetectedLineSegment): readonly [Point, Point] {
  const first = { x: segment.x1, y: segment.y1 };
  const second = { x: segment.x2, y: segment.y2 };
  if (first.x < second.x || (first.x === second.x && first.y <= second.y)) return [first, second];
  return [second, first];
}

function doorLeafEvidence(
  proposal: Omit<BridgeProposal, "key" | "selectedLeaf">,
  symbolSegments: readonly DetectedLineSegment[],
): DoorLeafEvidence[] {
  const gapWidth = proposal.gapEnd - proposal.gapStart;
  const halfThickness = proposal.thicknessPx / 2;
  const wallAngle = segmentAngle(proposal.origin, add(proposal.origin, proposal.tangent));
  const minimumLength = gapWidth * 0.45;
  const maximumLength = gapWidth * 1.65;
  const anchorAlongTolerance = Math.max(10, gapWidth * 0.16);
  const anchorAcrossTolerance = Math.max(12, halfThickness + 6);
  const minimumLeafDepth = Math.max(18, gapWidth * 0.35);
  const freeAlongTolerance = gapWidth * 0.35;
  const candidates: DoorLeafEvidence[] = [];

  for (const segment of symbolSegments) {
    const [firstPoint, secondPoint] = canonicalSegmentPoints(segment);
    const lengthPx = distance(firstPoint, secondPoint);
    if (!Number.isFinite(lengthPx) || lengthPx < minimumLength || lengthPx > maximumLength) continue;
    if (angleDelta(segmentAngle(firstPoint, secondPoint), wallAngle) < 20) continue;
    const first = projectEndpoint(firstPoint, proposal);
    const second = projectEndpoint(secondPoint, proposal);

    for (const [anchor, free] of [[first, second], [second, first]] as const) {
      const startDistance = Math.abs(anchor.along - proposal.gapStart);
      const endDistance = Math.abs(anchor.along - proposal.gapEnd);
      const edgeDistance = Math.min(startDistance, endDistance);
      if (edgeDistance > anchorAlongTolerance) continue;
      if (Math.abs(anchor.across) > anchorAcrossTolerance) continue;
      if (Math.abs(free.across) < minimumLeafDepth) continue;
      if (free.along < proposal.gapStart - freeAlongTolerance || free.along > proposal.gapEnd + freeAlongTolerance) continue;
      const anchorSide = startDistance <= endDistance ? "start" as const : "end" as const;
      candidates.push({
        anchorSide,
        anchor,
        free,
        lengthPx,
        key: [
          anchorSide,
          Math.round(anchor.point.x),
          Math.round(anchor.point.y),
          Math.round(free.point.x),
          Math.round(free.point.y),
        ].join("-"),
      });
      break;
    }
  }

  const deduplicated: DoorLeafEvidence[] = [];
  for (const candidate of candidates.sort((first, second) => first.key.localeCompare(second.key))) {
    const duplicate = deduplicated.some((existing) =>
      existing.anchorSide === candidate.anchorSide
      && distance(existing.anchor.point, candidate.anchor.point) <= 12
      && distance(existing.free.point, candidate.free.point) <= 18);
    if (!duplicate) deduplicated.push(candidate);
  }
  return deduplicated;
}

function segmentConnectsPoints(segment: DetectedLineSegment, first: Point, second: Point, tolerancePx: number): boolean {
  const a = { x: segment.x1, y: segment.y1 };
  const b = { x: segment.x2, y: segment.y2 };
  return (distance(a, first) <= tolerancePx && distance(b, second) <= tolerancePx)
    || (distance(a, second) <= tolerancePx && distance(b, first) <= tolerancePx);
}

function enclosureDetected(
  leaves: readonly DoorLeafEvidence[],
  symbolSegments: readonly DetectedLineSegment[],
  gapWidth: number,
): boolean {
  const startLeaves = leaves.filter((leaf) => leaf.anchorSide === "start");
  const endLeaves = leaves.filter((leaf) => leaf.anchorSide === "end");
  const connectionTolerance = Math.max(10, gapWidth * 0.12);
  return startLeaves.some((first) => endLeaves.some((second) =>
    symbolSegments.some((segment) => segmentConnectsPoints(
      segment,
      first.free.point,
      second.free.point,
      connectionTolerance,
    ))));
}

function proposalForPair(
  first: WallGeometry,
  second: WallGeometry,
  firstIndex: number,
  secondIndex: number,
  symbolSegments: readonly DetectedLineSegment[],
): PairEvaluation {
  if (angleDelta(first.angleDeg, second.angleDeg) > 8) return { proposal: null, diagnostics: [] };
  const tangent = first.tangent;
  const normal = first.normal;
  const origin = first.start;
  const firstInterval = projectInterval(first, origin, tangent);
  const secondInterval = projectInterval(second, origin, tangent);
  const firstOffset = dot(subtract(first.start, origin), normal);
  const secondOffset = dot(subtract(second.start, origin), normal);
  const averageThickness = (first.thicknessPx + second.thicknessPx) / 2;
  if (Math.max(first.thicknessPx, second.thicknessPx) / Math.min(first.thicknessPx, second.thicknessPx) > 1.8) {
    return { proposal: null, diagnostics: [] };
  }
  if (Math.abs(firstOffset - secondOffset) > Math.max(4, averageThickness * 0.35)) {
    return { proposal: null, diagnostics: [] };
  }

  const left = firstInterval.start <= secondInterval.start ? firstInterval : secondInterval;
  const right = left === firstInterval ? secondInterval : firstInterval;
  const gapStart = left.end;
  const gapEnd = right.start;
  const gapWidth = gapEnd - gapStart;
  if (gapWidth < MIN_DOOR_GAP_PX || gapWidth > MAX_DOOR_GAP_PX) {
    return { proposal: null, diagnostics: [] };
  }

  const sourceIds = [first.candidate.id, second.candidate.id].sort();
  const lineOffset = (firstOffset * first.length + secondOffset * second.length) / (first.length + second.length);
  const partial: Omit<BridgeProposal, "key" | "selectedLeaf"> = {
    firstId: sourceIds[0]!,
    secondId: sourceIds[1]!,
    firstIndex,
    secondIndex,
    tangent,
    normal,
    origin,
    lineOffset,
    unionStart: Math.min(firstInterval.start, secondInterval.start),
    unionEnd: Math.max(firstInterval.end, secondInterval.end),
    gapStart,
    gapEnd,
    thicknessPx: averageThickness,
    localScore: Math.min(0.74, Math.max(
      first.candidate.evidence.localScore ?? 0.68,
      second.candidate.evidence.localScore ?? 0.68,
      0.72,
    )),
    evidenceReasons: [...new Set([
      ...first.candidate.evidence.reasons,
      ...second.candidate.evidence.reasons,
      "door-leaf-anchored",
      "door-symbol-host-bridge",
    ])].sort(),
  };
  const leaves = doorLeafEvidence(partial, symbolSegments);
  if (leaves.length === 0) return { proposal: null, diagnostics: [] };
  if (enclosureDetected(leaves, symbolSegments, gapWidth)) {
    return { proposal: null, diagnostics: ["door-host-enclosure-rejected"] };
  }
  const selectedLeaf = [...leaves].sort((firstLeaf, secondLeaf) => {
    const firstRatio = Math.abs(firstLeaf.lengthPx / gapWidth - 1);
    const secondRatio = Math.abs(secondLeaf.lengthPx / gapWidth - 1);
    return firstRatio - secondRatio || firstLeaf.key.localeCompare(secondLeaf.key);
  })[0]!;
  return {
    proposal: {
      ...partial,
      selectedLeaf,
      key: `${selectedLeaf.key}|${gapStart.toFixed(4)}|${gapEnd.toFixed(4)}|${sourceIds.join("|")}`,
    },
    diagnostics: [],
  };
}

function intersectionAlong(
  proposal: BridgeProposal,
  wall: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): number | null {
  const geometry = canonicalGeometry(wall, widthPx, heightPx);
  if (!geometry || angleDelta(geometry.angleDeg, segmentAngle(
    proposal.origin,
    add(proposal.origin, proposal.tangent),
  )) < 70) return null;
  const firstAcross = dot(subtract(geometry.start, proposal.origin), proposal.normal) - proposal.lineOffset;
  const secondAcross = dot(subtract(geometry.end, proposal.origin), proposal.normal) - proposal.lineOffset;
  const tolerance = Math.max(3, proposal.thicknessPx * 0.35);
  if (Math.min(Math.abs(firstAcross), Math.abs(secondAcross)) > tolerance && firstAcross * secondAcross > 0) return null;
  const denominator = firstAcross - secondAcross;
  const ratio = Math.abs(denominator) <= EPSILON ? 0.5 : firstAcross / denominator;
  if (ratio < -0.05 || ratio > 1.05) return null;
  const point = add(geometry.start, scale(subtract(geometry.end, geometry.start), ratio));
  return dot(subtract(point, proposal.origin), proposal.tangent);
}

function createWallCandidate(
  id: string,
  proposal: BridgeProposal,
  startAlong: number,
  endAlong: number,
  widthPx: number,
  heightPx: number,
  residual: boolean,
): RecognitionWallCandidate {
  const start = pointOnLine(proposal.origin, proposal.tangent, proposal.normal, startAlong, proposal.lineOffset);
  const end = pointOnLine(proposal.origin, proposal.tangent, proposal.normal, endAlong, proposal.lineOffset);
  return {
    id,
    start: { x: clamp01(start.x / widthPx), y: clamp01(start.y / heightPx) },
    end: { x: clamp01(end.x / widthPx), y: clamp01(end.y / heightPx) },
    estimatedThicknessPx: proposal.thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: proposal.localScore,
      cloudScore: null,
      reasons: residual
        ? [...new Set([...proposal.evidenceReasons, "door-host-residual"])].sort()
        : proposal.evidenceReasons,
    },
    origin: "local",
    conflict: null,
  };
}

function createOpeningHypothesis(
  id: string,
  hostWallCandidateId: string,
  proposal: BridgeProposal,
  widthPx: number,
  heightPx: number,
): RecognitionOpeningCandidate {
  const gapCenterAlong = (proposal.gapStart + proposal.gapEnd) / 2;
  const center = pointOnLine(
    proposal.origin,
    proposal.tangent,
    proposal.normal,
    gapCenterAlong,
    proposal.lineOffset,
  );
  return {
    id,
    kind: "door",
    hostWallCandidateId,
    center: { x: clamp01(center.x / widthPx), y: clamp01(center.y / heightPx) },
    widthPx: proposal.gapEnd - proposal.gapStart,
    orientationDeg: segmentAngle(proposal.origin, add(proposal.origin, proposal.tangent)),
    confidence: "medium",
    evidence: {
      localScore: proposal.localScore,
      cloudScore: null,
      reasons: [...new Set([
        ...proposal.evidenceReasons,
        "door-gap-from-bridge",
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

function doorOpeningEligibility(
  proposal: BridgeProposal,
  hostStart: number,
  hostEnd: number,
): DoorOpeningEligibility {
  const rawStartMarginPx = Math.max(0, proposal.gapStart - hostStart);
  const rawEndMarginPx = Math.max(0, hostEnd - proposal.gapEnd);
  const minimumMarginPx = DEFAULT_OPENING_ANALYSIS_OPTIONS.minimumEndMarginPx;
  const eligible = rawStartMarginPx + EPSILON >= minimumMarginPx
    && rawEndMarginPx + EPSILON >= minimumMarginPx;
  return {
    eligible,
    startMarginPx: stablePixelValue(rawStartMarginPx),
    endMarginPx: stablePixelValue(rawEndMarginPx),
    minimumMarginPx,
    reason: eligible ? null : "generated-host-end-margin",
  };
}

function createProposalEvidence(
  candidateId: string,
  proposal: BridgeProposal,
  hostStart: number,
  hostEnd: number,
  openingEligibility: DoorOpeningEligibility,
): DoorHostProposalEvidence {
  const point = (along: number): Point => pointOnLine(
    proposal.origin,
    proposal.tangent,
    proposal.normal,
    along,
    proposal.lineOffset,
  );
  return {
    sourceWallCandidateIds: [proposal.firstId, proposal.secondId],
    selectedLeaf: {
      anchorSide: proposal.selectedLeaf.anchorSide,
      anchor: proposal.selectedLeaf.anchor.point,
      free: proposal.selectedLeaf.free.point,
      lengthPx: proposal.selectedLeaf.lengthPx,
    },
    gap: {
      start: point(proposal.gapStart),
      end: point(proposal.gapEnd),
      widthPx: proposal.gapEnd - proposal.gapStart,
    },
    generatedHost: {
      candidateId,
      start: point(hostStart),
      end: point(hostEnd),
    },
    openingEligibility,
  };
}

function sortWalls(
  walls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate[] {
  return [...walls].sort((first, second) => {
    const aStart = pixelPoint(first, "start", widthPx, heightPx);
    const aEnd = pixelPoint(first, "end", widthPx, heightPx);
    const bStart = pixelPoint(second, "start", widthPx, heightPx);
    const bEnd = pixelPoint(second, "end", widthPx, heightPx);
    const aAngle = segmentAngle(aStart, aEnd);
    const bAngle = segmentAngle(bStart, bEnd);
    return aAngle - bAngle
      || Math.min(aStart.x, aEnd.x) - Math.min(bStart.x, bEnd.x)
      || Math.min(aStart.y, aEnd.y) - Math.min(bStart.y, bEnd.y)
      || first.id.localeCompare(second.id);
  });
}

function applyProposal(
  walls: readonly RecognitionWallCandidate[],
  proposal: BridgeProposal,
  widthPx: number,
  heightPx: number,
): AppliedProposal {
  const otherWalls = walls.filter((_wall, index) => index !== proposal.firstIndex && index !== proposal.secondIndex);
  const intersections = otherWalls
    .map((wall) => intersectionAlong(proposal, wall, widthPx, heightPx))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const leftJunctions = intersections.filter((value) => value <= proposal.gapStart + EPSILON);
  const rightJunctions = intersections.filter((value) => value >= proposal.gapEnd - EPSILON);
  const hostStart = clamp(
    leftJunctions.length > 0 ? Math.max(...leftJunctions) : proposal.unionStart,
    proposal.unionStart,
    proposal.gapStart,
  );
  const hostEnd = clamp(
    rightJunctions.length > 0 ? Math.min(...rightJunctions) : proposal.unionEnd,
    proposal.gapEnd,
    proposal.unionEnd,
  );
  if (hostEnd - hostStart < MIN_DOOR_GAP_PX) {
    return { walls: [...walls], openingHypothesis: null, proposalEvidence: null };
  }

  const sourceId = `${proposal.firstId}--${proposal.secondId}`;
  const baseId = `local-door-host-${sourceId}`;
  const openingEligibility = doorOpeningEligibility(proposal, hostStart, hostEnd);
  const replacements: RecognitionWallCandidate[] = [];
  if (hostStart - proposal.unionStart >= MIN_FRAGMENT_LENGTH_PX) {
    replacements.push(createWallCandidate(
      `${baseId}-residual-before`,
      proposal,
      proposal.unionStart,
      hostStart,
      widthPx,
      heightPx,
      true,
    ));
  }
  replacements.push(createWallCandidate(
    baseId,
    proposal,
    hostStart,
    hostEnd,
    widthPx,
    heightPx,
    false,
  ));
  if (proposal.unionEnd - hostEnd >= MIN_FRAGMENT_LENGTH_PX) {
    replacements.push(createWallCandidate(
      `${baseId}-residual-after`,
      proposal,
      hostEnd,
      proposal.unionEnd,
      widthPx,
      heightPx,
      true,
    ));
  }
  return {
    walls: sortWalls([...otherWalls, ...replacements], widthPx, heightPx),
    openingHypothesis: openingEligibility.eligible
      ? createOpeningHypothesis(
          `local-door-opening-${sourceId}`,
          baseId,
          proposal,
          widthPx,
          heightPx,
        )
      : null,
    proposalEvidence: createProposalEvidence(
      baseId,
      proposal,
      hostStart,
      hostEnd,
      openingEligibility,
    ),
  };
}

function nextProposal(
  walls: readonly RecognitionWallCandidate[],
  symbolSegments: readonly DetectedLineSegment[],
  widthPx: number,
  heightPx: number,
): Readonly<{ proposal: BridgeProposal | null; diagnostics: readonly string[] }> {
  const geometries = walls.map((wall) => canonicalGeometry(wall, widthPx, heightPx));
  const proposals: BridgeProposal[] = [];
  const diagnostics = new Set<string>();
  for (let firstIndex = 0; firstIndex < geometries.length; firstIndex += 1) {
    const first = geometries[firstIndex];
    if (!first) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < geometries.length; secondIndex += 1) {
      const second = geometries[secondIndex];
      if (!second) continue;
      const evaluation = proposalForPair(first, second, firstIndex, secondIndex, symbolSegments);
      for (const diagnostic of evaluation.diagnostics) diagnostics.add(diagnostic);
      if (!evaluation.proposal) continue;
      const blocked = walls.some((wall, index) => {
        if (index === firstIndex || index === secondIndex) return false;
        const along = intersectionAlong(evaluation.proposal!, wall, widthPx, heightPx);
        return along !== null
          && along > evaluation.proposal!.gapStart + EPSILON
          && along < evaluation.proposal!.gapEnd - EPSILON;
      });
      if (!blocked) proposals.push(evaluation.proposal);
    }
  }
  return {
    proposal: proposals.sort((first, second) => first.key.localeCompare(second.key))[0] ?? null,
    diagnostics: [...diagnostics].sort(),
  };
}

export function consolidateDoorHostWalls(
  input: DoorHostConsolidationInput,
): DoorHostConsolidationResult {
  if (!Number.isFinite(input.widthPx) || input.widthPx <= 0 || !Number.isFinite(input.heightPx) || input.heightPx <= 0) {
    throw new Error("Размер изображения должен быть положительным и конечным.");
  }
  if (input.wallCandidates.length > MAX_WALL_CANDIDATES) {
    return {
      walls: input.wallCandidates,
      openingHypotheses: [],
      proposalEvidence: [],
      acceptedBridgeCount: 0,
      diagnostics: ["door-host-budget-exceeded"],
    };
  }
  if (input.symbolSegments.length > MAX_SYMBOL_SEGMENTS) {
    return {
      walls: input.wallCandidates,
      openingHypotheses: [],
      proposalEvidence: [],
      acceptedBridgeCount: 0,
      diagnostics: ["door-symbol-budget-exceeded"],
    };
  }

  let walls: readonly RecognitionWallCandidate[] = input.wallCandidates;
  let acceptedBridgeCount = 0;
  const openingHypotheses: RecognitionOpeningCandidate[] = [];
  const proposalEvidence: DoorHostProposalEvidence[] = [];
  const diagnostics = new Set<string>();
  while (acceptedBridgeCount < MAX_ACCEPTED_BRIDGES) {
    const next = nextProposal(walls, input.symbolSegments, input.widthPx, input.heightPx);
    for (const diagnostic of next.diagnostics) diagnostics.add(diagnostic);
    if (!next.proposal) break;
    const applied = applyProposal(walls, next.proposal, input.widthPx, input.heightPx);
    if (!applied.proposalEvidence) break;
    walls = applied.walls;
    if (applied.openingHypothesis) openingHypotheses.push(applied.openingHypothesis);
    else diagnostics.add("door-opening-host-margin-rejected");
    proposalEvidence.push(applied.proposalEvidence);
    acceptedBridgeCount += 1;
  }
  if (acceptedBridgeCount === MAX_ACCEPTED_BRIDGES) diagnostics.add("door-host-bridge-budget-reached");

  return {
    walls,
    openingHypotheses: openingHypotheses.sort((first, second) => first.id.localeCompare(second.id)),
    proposalEvidence: proposalEvidence.sort((first, second) =>
      first.generatedHost.candidateId.localeCompare(second.generatedHost.candidateId)),
    acceptedBridgeCount,
    diagnostics: [...diagnostics].sort(),
  };
}
