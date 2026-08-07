import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionDiagnostic, RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type StrongMaskRotatedDoorHostRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredWalls: readonly RecognitionWallCandidate[];
  recoveredCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type SeedGeometry = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  thicknessPx: number;
  angleDeg: number;
}>;
type RailEvidence = Readonly<{
  source: DetectedLineSegment;
  startAlong: number;
  endAlong: number;
  meanOffsetPx: number;
  angleDeg: number;
  lengthPx: number;
  key: string;
}>;
type HostProposal = Readonly<{
  seed: SeedGeometry;
  candidate: RecognitionWallCandidate;
  railGapStartPx: number;
  railGapEndPx: number;
  railGapWidthPx: number;
  externalExtensionPx: number;
  key: string;
}>;

type VerifiedProposal = Readonly<{
  proposal: HostProposal;
  opening: RecognitionOpeningCandidate;
  score: number;
}>;

const MAX_WALL_CANDIDATES = 128;
const MAX_STRUCTURAL_SEGMENTS = 512;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_RECOVERIES = 4;
const MIN_ROTATED_AXIS_DELTA_DEG = 20;
const MAX_RAIL_ANGLE_DELTA_DEG = 5;
const MAX_SEED_LENGTH_SHORT_SIDE_RATIO = 0.18;
const MIN_RAIL_LENGTH_SHORT_SIDE_RATIO = 0.045;
const MIN_RAIL_OFFSET_THICKNESS_RATIO = 0.22;
const MAX_RAIL_OFFSET_THICKNESS_RATIO = 0.95;
const MAX_RAIL_OFFSET_DRIFT_THICKNESS_RATIO = 0.3;
const MAX_PAIR_OFFSET_DELTA_THICKNESS_RATIO = 0.35;
const MIN_RAIL_GAP_PX = 55;
const MAX_RAIL_GAP_PX = 240;
const MIN_SEED_OVERLAP_PX = 10;
const MAX_SEED_RAIL_DISTANCE_THICKNESS_RATIO = 0.75;
const MIN_RECOVERED_LENGTH_SHORT_SIDE_RATIO = 0.2;
const MAX_OPENING_RAIL_GAP_CENTER_DELTA_PX = 28;
const MIN_OPENING_TO_RAIL_GAP_RATIO = 0.5;
const MAX_OPENING_TO_RAIL_GAP_RATIO = 1.5;
const MAX_DUPLICATE_ANGLE_DELTA_DEG = 8;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function angleDeg(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function axisDelta(angle: number): number {
  return Math.min(angle, Math.abs(90 - angle), Math.abs(180 - angle));
}

function canonicalPoints(first: Point, second: Point): readonly [Point, Point] {
  return first.x < second.x || (Math.abs(first.x - second.x) <= EPSILON && first.y <= second.y)
    ? [first, second]
    : [second, first];
}

function seedGeometry(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
  shortSide: number,
): SeedGeometry | null {
  if (candidate.conflict !== null) return null;
  const thicknessPx = candidate.estimatedThicknessPx;
  if (thicknessPx === null || !Number.isFinite(thicknessPx) || thicknessPx <= 0) return null;
  const [start, end] = canonicalPoints(
    { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx },
    { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx },
  );
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return null;
  const angle = angleDeg(start, end);
  if (axisDelta(angle) < MIN_ROTATED_AXIS_DELTA_DEG) return null;
  if (lengthPx > shortSide * MAX_SEED_LENGTH_SHORT_SIDE_RATIO) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    thicknessPx,
    angleDeg: angle,
  };
}

function railEvidence(
  seed: SeedGeometry,
  segment: DetectedLineSegment,
  shortSide: number,
): RailEvidence | null {
  const first = { x: segment.x1, y: segment.y1 };
  const second = { x: segment.x2, y: segment.y2 };
  if (![first.x, first.y, second.x, second.y].every(Number.isFinite)) return null;
  const lengthPx = distance(first, second);
  if (lengthPx < shortSide * MIN_RAIL_LENGTH_SHORT_SIDE_RATIO) return null;
  const segmentAngle = angleDeg(first, second);
  if (angleDelta(segmentAngle, seed.angleDeg) > MAX_RAIL_ANGLE_DELTA_DEG) return null;

  const firstRelative = subtract(first, seed.start);
  const secondRelative = subtract(second, seed.start);
  const firstOffset = dot(firstRelative, seed.normal);
  const secondOffset = dot(secondRelative, seed.normal);
  if (firstOffset * secondOffset <= 0) return null;
  const meanOffsetPx = (firstOffset + secondOffset) / 2;
  const absoluteOffset = Math.abs(meanOffsetPx);
  if (
    absoluteOffset < seed.thicknessPx * MIN_RAIL_OFFSET_THICKNESS_RATIO
    || absoluteOffset > seed.thicknessPx * MAX_RAIL_OFFSET_THICKNESS_RATIO
  ) return null;
  if (
    Math.abs(firstOffset - secondOffset)
      > Math.max(4, seed.thicknessPx * MAX_RAIL_OFFSET_DRIFT_THICKNESS_RATIO)
  ) return null;

  const firstAlong = dot(firstRelative, seed.tangent);
  const secondAlong = dot(secondRelative, seed.tangent);
  const startAlong = Math.min(firstAlong, secondAlong);
  const endAlong = Math.max(firstAlong, secondAlong);
  return {
    source: segment,
    startAlong,
    endAlong,
    meanOffsetPx,
    angleDeg: segmentAngle,
    lengthPx,
    key: [segment.x1, segment.y1, segment.x2, segment.y2]
      .map((value) => Math.round(value * 2))
      .join(":"),
  };
}

function intervalOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): number {
  return Math.max(0, Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart));
}

function intervalDistance(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): number {
  if (intervalOverlap(firstStart, firstEnd, secondStart, secondEnd) > 0) return 0;
  return Math.max(firstStart, secondStart) - Math.min(firstEnd, secondEnd);
}

function pairProposal(
  seed: SeedGeometry,
  first: RailEvidence,
  second: RailEvidence,
  widthPx: number,
  heightPx: number,
  shortSide: number,
): HostProposal | null {
  if (first.meanOffsetPx * second.meanOffsetPx <= 0) return null;
  if (
    Math.abs(Math.abs(first.meanOffsetPx) - Math.abs(second.meanOffsetPx))
      > Math.max(8, seed.thicknessPx * MAX_PAIR_OFFSET_DELTA_THICKNESS_RATIO)
  ) return null;
  if (angleDelta(first.angleDeg, second.angleDeg) > MAX_RAIL_ANGLE_DELTA_DEG) return null;

  const ordered = first.startAlong <= second.startAlong ? [first, second] as const : [second, first] as const;
  const railGapStartPx = ordered[0].endAlong;
  const railGapEndPx = ordered[1].startAlong;
  const railGapWidthPx = railGapEndPx - railGapStartPx;
  if (railGapWidthPx < MIN_RAIL_GAP_PX || railGapWidthPx > MAX_RAIL_GAP_PX) return null;

  const seedOverlap = ordered.map((rail) => intervalOverlap(rail.startAlong, rail.endAlong, 0, seed.lengthPx));
  const seedDistance = ordered.map((rail) => intervalDistance(rail.startAlong, rail.endAlong, 0, seed.lengthPx));
  const seedAttached = seedOverlap.map((overlap, index) =>
    overlap >= MIN_SEED_OVERLAP_PX
    || seedDistance[index]! <= Math.max(12, seed.thicknessPx * MAX_SEED_RAIL_DISTANCE_THICKNESS_RATIO));
  if (seedAttached.filter(Boolean).length !== 1) return null;
  const attachedIndex = seedAttached[0] ? 0 : 1;
  const externalIndex = attachedIndex === 0 ? 1 : 0;
  const attached = ordered[attachedIndex]!;
  const external = ordered[externalIndex]!;
  const externalIsBefore = external.endAlong < attached.startAlong;
  if (externalIsBefore && external.endAlong >= 0) return null;
  if (!externalIsBefore && external.startAlong <= seed.lengthPx) return null;

  let startAlong = Math.min(0, first.startAlong, second.startAlong);
  let endAlong = Math.max(seed.lengthPx, first.endAlong, second.endAlong);
  const halfThickness = seed.thicknessPx / 2;
  if (startAlong < 0) startAlong += halfThickness;
  if (endAlong > seed.lengthPx) endAlong -= halfThickness;
  if (endAlong - startAlong < shortSide * MIN_RECOVERED_LENGTH_SHORT_SIDE_RATIO) return null;
  if (railGapStartPx <= startAlong + EPSILON || railGapEndPx >= endAlong - EPSILON) return null;

  const start = add(seed.start, scale(seed.tangent, startAlong));
  const end = add(seed.start, scale(seed.tangent, endAlong));
  const geometryKey = [start.x, start.y, end.x, end.y, seed.thicknessPx]
    .map((value) => Math.round(value * 10))
    .join("-");
  const candidate: RecognitionWallCandidate = {
    ...seed.candidate,
    id: `strong-mask-rotated-door-host-${geometryKey}`,
    start: { x: start.x / widthPx, y: start.y / heightPx },
    end: { x: end.x / widthPx, y: end.y / heightPx },
    confidence: "medium",
    conflict: null,
    evidence: {
      ...seed.candidate.evidence,
      localScore: Math.min(seed.candidate.evidence.localScore ?? 0.74, 0.78),
      reasons: [...new Set([
        ...seed.candidate.evidence.reasons,
        "same-side-structural-rail-pair",
        "strong-mask-rotated-door-host",
      ])].sort(),
    },
  };
  const externalExtensionPx = externalIsBefore
    ? Math.max(0, -external.startAlong)
    : Math.max(0, external.endAlong - seed.lengthPx);
  return {
    seed,
    candidate,
    railGapStartPx: railGapStartPx - startAlong,
    railGapEndPx: railGapEndPx - startAlong,
    railGapWidthPx,
    externalExtensionPx,
    key: `${seed.candidate.id}|${ordered[0].key}|${ordered[1].key}`,
  };
}

function openingAlong(candidate: RecognitionWallCandidate, opening: RecognitionOpeningCandidate, widthPx: number, heightPx: number): number | null {
  const start = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  const end = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (lengthPx <= EPSILON) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  const center = { x: opening.center.x * widthPx, y: opening.center.y * heightPx };
  return dot(subtract(center, start), tangent);
}

function verifyProposal(
  proposal: HostProposal,
  input: Readonly<{
    widthPx: number;
    heightPx: number;
    symbolSegments: readonly DetectedLineSegment[];
    mask: StructuralMaskView;
  }>,
): VerifiedProposal | null {
  const detected = detectContinuousHostDoorOpenings({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: [proposal.candidate],
    symbolSegments: input.symbolSegments,
    mask: input.mask,
  });
  const railGapCenterPx = (proposal.railGapStartPx + proposal.railGapEndPx) / 2;
  const matches = detected.openingHypotheses.flatMap((opening): VerifiedProposal[] => {
    if (opening.hostWallCandidateId !== proposal.candidate.id || opening.widthPx === null) return [];
    const centerAlong = openingAlong(proposal.candidate, opening, input.widthPx, input.heightPx);
    if (centerAlong === null || Math.abs(centerAlong - railGapCenterPx) > MAX_OPENING_RAIL_GAP_CENTER_DELTA_PX) return [];
    const widthRatio = opening.widthPx / proposal.railGapWidthPx;
    if (widthRatio < MIN_OPENING_TO_RAIL_GAP_RATIO || widthRatio > MAX_OPENING_TO_RAIL_GAP_RATIO) return [];
    return [{
      proposal,
      opening,
      score: Math.abs(opening.widthPx - proposal.railGapWidthPx)
        - Math.min(200, proposal.externalExtensionPx) * 0.001,
    }];
  }).sort((first, second) => first.score - second.score || first.proposal.key.localeCompare(second.proposal.key));
  return matches[0] ?? null;
}

function physicalDuplicate(
  candidate: RecognitionWallCandidate,
  seedId: string,
  walls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): boolean {
  const start = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  const end = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (lengthPx <= EPSILON) return false;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  const angle = angleDeg(start, end);
  const center = scale(add(start, end), 0.5);
  const candidateThickness = candidate.estimatedThicknessPx ?? 20;

  return walls.some((wall) => {
    if (wall.id === seedId || wall.conflict !== null) return false;
    const wallStart = { x: wall.start.x * widthPx, y: wall.start.y * heightPx };
    const wallEnd = { x: wall.end.x * widthPx, y: wall.end.y * heightPx };
    const wallLength = distance(wallStart, wallEnd);
    if (wallLength <= EPSILON || angleDelta(angle, angleDeg(wallStart, wallEnd)) > MAX_DUPLICATE_ANGLE_DELTA_DEG) return false;
    const tolerancePx = Math.max(12, Math.min(candidateThickness, wall.estimatedThicknessPx ?? 20) * 0.6);
    if (pointToSegmentDistance(center, wallStart, wallEnd) > tolerancePx) return false;
    const first = dot(subtract(wallStart, start), tangent);
    const second = dot(subtract(wallEnd, start), tangent);
    const overlap = Math.max(0, Math.min(lengthPx, Math.max(first, second)) - Math.max(0, Math.min(first, second)));
    return overlap / Math.max(EPSILON, Math.min(lengthPx, wallLength)) >= 0.65;
  });
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const vector = subtract(end, start);
  const lengthSquared = dot(vector, vector);
  if (lengthSquared <= EPSILON) return distance(point, start);
  const ratio = clamp(dot(subtract(point, start), vector) / lengthSquared, 0, 1);
  return distance(point, add(start, scale(vector, ratio)));
}

function withDoorEvidence(candidate: RecognitionWallCandidate): RecognitionWallCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "continuous-host-mask-door-gap",
        "perpendicular-door-leaf-evidence",
      ])].sort(),
    },
  };
}

export function recoverStrongMaskRotatedDoorHosts(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  structuralSegments: readonly DetectedLineSegment[];
  symbolSegments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): StrongMaskRotatedDoorHostRecoveryResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
    || input.primaryWalls.length > MAX_WALL_CANDIDATES
    || input.structuralSegments.length > MAX_STRUCTURAL_SEGMENTS
    || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS
  ) {
    return {
      walls: [...input.primaryWalls].sort((first, second) => first.id.localeCompare(second.id)),
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: [],
    };
  }

  const shortSide = Math.min(input.widthPx, input.heightPx);
  const seeds = input.primaryWalls
    .map((candidate) => seedGeometry(candidate, input.widthPx, input.heightPx, shortSide))
    .filter((seed): seed is SeedGeometry => seed !== null)
    .sort((first, second) => first.candidate.id.localeCompare(second.candidate.id));
  const accepted = new Map<string, RecognitionWallCandidate>(
    input.primaryWalls.map((candidate) => [candidate.id, candidate]),
  );
  const recovered: RecognitionWallCandidate[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];

  for (const seed of seeds) {
    if (recovered.length >= MAX_RECOVERIES) break;
    const rails = input.structuralSegments
      .map((segment) => railEvidence(seed, segment, shortSide))
      .filter((rail): rail is RailEvidence => rail !== null)
      .sort((first, second) => first.startAlong - second.startAlong || first.key.localeCompare(second.key));
    const verified: VerifiedProposal[] = [];
    for (let firstIndex = 0; firstIndex < rails.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < rails.length; secondIndex += 1) {
        const proposal = pairProposal(
          seed,
          rails[firstIndex]!,
          rails[secondIndex]!,
          input.widthPx,
          input.heightPx,
          shortSide,
        );
        if (!proposal) continue;
        if (physicalDuplicate(proposal.candidate, seed.candidate.id, [...accepted.values()], input.widthPx, input.heightPx)) continue;
        const proof = verifyProposal(proposal, input);
        if (proof) verified.push(proof);
      }
    }
    verified.sort((first, second) => first.score - second.score || first.proposal.key.localeCompare(second.proposal.key));
    const winner = verified[0];
    if (!winner) continue;

    const candidate = withDoorEvidence(winner.proposal.candidate);
    accepted.delete(seed.candidate.id);
    accepted.set(candidate.id, candidate);
    recovered.push(candidate);
    diagnostics.push({
      code: "strong-mask-rotated-door-host",
      severity: "info",
      message: "Диагональная перегородка через дверной разрыв восстановлена только после подтверждения существующего centerline seed, двух collinear boundary rails и повторного production door-leaf/mask-gap анализа.",
      candidateId: candidate.id,
    });
  }

  return {
    walls: [...accepted.values()].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls: [...recovered].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredCount: recovered.length,
    diagnostics: diagnostics.sort((first, second) =>
      (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
