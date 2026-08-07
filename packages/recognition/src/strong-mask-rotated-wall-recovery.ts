import type { DetectedLineSegment } from "./local-lines";
import { analyzeWallCandidates } from "./local-lines";
import type { RecognitionDiagnostic, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type StrongMaskRotatedWallRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredWalls: readonly RecognitionWallCandidate[];
  recoveredCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  thicknessPx: number;
  angleDeg: number;
}>;
type SegmentGeometry = Readonly<{
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
}>;

const MAX_WALL_CANDIDATES = 128;
const MAX_SEGMENTS = 512;
const MAX_PARTIAL_PAIR_RECOVERIES = 4;
const MIN_ROTATED_AXIS_DELTA_DEG = 20;
const MAX_DUPLICATE_ANGLE_DELTA_DEG = 8;
const MAX_PARTIAL_PAIR_ANGLE_DELTA_DEG = 5;
const MIN_LENGTH_SHORT_SIDE_RATIO = 0.35;
const MIN_PARTIAL_PAIR_LONG_LENGTH_SHORT_SIDE_RATIO = 0.45;
const MIN_PARTIAL_PAIR_MATE_LENGTH_RATIO = 0.5;
const MAX_PARTIAL_PAIR_MATE_LENGTH_RATIO = 0.85;
const MIN_PARTIAL_PAIR_PROJECTED_OVERLAP_RATIO = 0.9;
const MIN_PARTIAL_PAIR_THICKNESS_PX = 8;
const MAX_PARTIAL_PAIR_THICKNESS_PX = 90;
const MAX_PARTIAL_PAIR_OFFSET_DRIFT_RATIO = 0.15;
const MIN_MASK_OCCUPANCY = 0.95;
const MIN_MASK_CONTINUITY = 0.95;
const MAX_ALONG_SAMPLES = 224;
const ACROSS_SAMPLES = 7;
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
  return first.x < second.x || (first.x === second.x && first.y <= second.y)
    ? [first, second]
    : [second, first];
}

function segmentGeometry(segment: DetectedLineSegment): SegmentGeometry | null {
  if (![segment.x1, segment.y1, segment.x2, segment.y2].every(Number.isFinite)) return null;
  const [start, end] = canonicalPoints(
    { x: segment.x1, y: segment.y1 },
    { x: segment.x2, y: segment.y2 },
  );
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (lengthPx <= EPSILON) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  return {
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: angleDeg(start, end),
  };
}

function compareSegmentGeometry(first: SegmentGeometry, second: SegmentGeometry): number {
  return first.start.x - second.start.x
    || first.start.y - second.start.y
    || first.end.x - second.end.x
    || first.end.y - second.end.y
    || first.lengthPx - second.lengthPx;
}

function pixelPoint(
  point: RecognitionWallCandidate["start"],
  widthPx: number,
  heightPx: number,
): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function pixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  const start = pixelPoint(candidate.start, widthPx, heightPx);
  const end = pixelPoint(candidate.end, widthPx, heightPx);
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  const thicknessPx = candidate.estimatedThicknessPx;
  if (
    !Number.isFinite(lengthPx)
    || lengthPx <= EPSILON
    || thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
  ) return null;
  return {
    candidate,
    start,
    end,
    tangent: { x: vector.x / lengthPx, y: vector.y / lengthPx },
    normal: { x: -vector.y / lengthPx, y: vector.x / lengthPx },
    lengthPx,
    thicknessPx,
    angleDeg: angleDeg(start, end),
  };
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const vector = subtract(end, start);
  const lengthSquared = dot(vector, vector);
  if (lengthSquared <= EPSILON) return distance(point, start);
  const ratio = clamp(dot(subtract(point, start), vector) / lengthSquared, 0, 1);
  return distance(point, add(start, scale(vector, ratio)));
}

function maskSupport(wall: PixelWall, mask: StructuralMaskView): Readonly<{
  occupancy: number;
  continuity: number;
}> {
  const alongSamples = Math.max(24, Math.min(MAX_ALONG_SAMPLES, Math.ceil(wall.lengthPx / 4)));
  const halfThickness = Math.max(3, wall.thicknessPx / 2);
  let structuralSamples = 0;
  let totalSamples = 0;
  let currentRun = 0;
  let longestRun = 0;

  for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
    const alongRatio = (alongIndex + 0.5) / alongSamples;
    const center = add(wall.start, scale(subtract(wall.end, wall.start), alongRatio));
    let structuralAcross = 0;
    for (let acrossIndex = 0; acrossIndex < ACROSS_SAMPLES; acrossIndex += 1) {
      const acrossRatio = (acrossIndex + 0.5) / ACROSS_SAMPLES;
      const offset = -halfThickness + 2 * halfThickness * acrossRatio;
      const point = add(center, scale(wall.normal, offset));
      totalSamples += 1;
      if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) {
        structuralSamples += 1;
        structuralAcross += 1;
      }
    }
    if (structuralAcross / ACROSS_SAMPLES >= 0.5) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return {
    occupancy: structuralSamples / Math.max(1, totalSamples),
    continuity: longestRun / alongSamples,
  };
}

function anchoredToPrimary(
  wall: PixelWall,
  primaryWalls: readonly PixelWall[],
): boolean {
  const tolerancePx = Math.max(18, wall.thicknessPx * 1.5);
  return primaryWalls.some((primary) =>
    primary.candidate.conflict === null
    && (
      pointToSegmentDistance(wall.start, primary.start, primary.end) <= tolerancePx
      || pointToSegmentDistance(wall.end, primary.start, primary.end) <= tolerancePx
    ));
}

function overlapRatio(first: PixelWall, second: PixelWall): number {
  const secondStart = dot(subtract(second.start, first.start), first.tangent);
  const secondEnd = dot(subtract(second.end, first.start), first.tangent);
  const overlap = Math.max(
    0,
    Math.min(first.lengthPx, Math.max(secondStart, secondEnd))
      - Math.max(0, Math.min(secondStart, secondEnd)),
  );
  return overlap / Math.max(EPSILON, Math.min(first.lengthPx, second.lengthPx));
}

function isPhysicalDuplicate(
  wall: PixelWall,
  primaryWalls: readonly PixelWall[],
): boolean {
  return primaryWalls.some((primary) => {
    if (primary.candidate.conflict !== null) return false;
    if (angleDelta(wall.angleDeg, primary.angleDeg) > MAX_DUPLICATE_ANGLE_DELTA_DEG) return false;
    const midpoint = scale(add(wall.start, wall.end), 0.5);
    const offsetTolerancePx = Math.max(12, Math.min(wall.thicknessPx, primary.thicknessPx) * 0.6);
    if (pointToSegmentDistance(midpoint, primary.start, primary.end) > offsetTolerancePx) return false;
    return overlapRatio(wall, primary) >= 0.65;
  });
}

function recoveredCandidate(candidate: RecognitionWallCandidate): RecognitionWallCandidate {
  return {
    ...candidate,
    id: `strong-mask-rotated-${candidate.id}`,
    confidence: "medium",
    conflict: null,
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.74, 0.78),
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "strong-mask-rotated-wall-chain",
      ])].sort(),
    },
  };
}

function partialPairCandidate(input: Readonly<{
  long: SegmentGeometry;
  mate: SegmentGeometry;
  widthPx: number;
  heightPx: number;
  shortSide: number;
}>): RecognitionWallCandidate | null {
  if (input.long.lengthPx < input.shortSide * MIN_PARTIAL_PAIR_LONG_LENGTH_SHORT_SIDE_RATIO) return null;
  if (axisDelta(input.long.angleDeg) < MIN_ROTATED_AXIS_DELTA_DEG) return null;
  if (angleDelta(input.long.angleDeg, input.mate.angleDeg) > MAX_PARTIAL_PAIR_ANGLE_DELTA_DEG) return null;

  const mateRatio = input.mate.lengthPx / input.long.lengthPx;
  if (
    mateRatio < MIN_PARTIAL_PAIR_MATE_LENGTH_RATIO
    || mateRatio > MAX_PARTIAL_PAIR_MATE_LENGTH_RATIO
  ) return null;

  const mateStartAlong = dot(subtract(input.mate.start, input.long.start), input.long.tangent);
  const mateEndAlong = dot(subtract(input.mate.end, input.long.start), input.long.tangent);
  const overlap = Math.max(
    0,
    Math.min(input.long.lengthPx, Math.max(mateStartAlong, mateEndAlong))
      - Math.max(0, Math.min(mateStartAlong, mateEndAlong)),
  );
  if (overlap / input.mate.lengthPx < MIN_PARTIAL_PAIR_PROJECTED_OVERLAP_RATIO) return null;

  const firstOffset = dot(subtract(input.mate.start, input.long.start), input.long.normal);
  const secondOffset = dot(subtract(input.mate.end, input.long.start), input.long.normal);
  if (firstOffset * secondOffset <= 0) return null;
  const signedOffset = (firstOffset + secondOffset) / 2;
  const thicknessPx = Math.abs(signedOffset);
  const maximumThicknessPx = Math.min(
    MAX_PARTIAL_PAIR_THICKNESS_PX,
    input.shortSide * 0.08,
  );
  if (
    thicknessPx < MIN_PARTIAL_PAIR_THICKNESS_PX
    || thicknessPx > maximumThicknessPx
  ) return null;
  const maximumOffsetDriftPx = Math.max(3, thicknessPx * MAX_PARTIAL_PAIR_OFFSET_DRIFT_RATIO);
  if (Math.abs(firstOffset - secondOffset) > maximumOffsetDriftPx) return null;

  const shift = scale(input.long.normal, signedOffset / 2);
  const untrimmedStart = add(input.long.start, shift);
  const untrimmedEnd = add(input.long.end, shift);
  const endTrimPx = thicknessPx / 2;
  if (input.long.lengthPx <= endTrimPx * 2 + EPSILON) return null;
  const start = add(untrimmedStart, scale(input.long.tangent, endTrimPx));
  const end = add(untrimmedEnd, scale(input.long.tangent, -endTrimPx));
  const geometryKey = [
    Math.round(start.x),
    Math.round(start.y),
    Math.round(end.x),
    Math.round(end.y),
    Math.round(thicknessPx),
  ].join("-");

  return {
    id: `strong-mask-rotated-partial-${geometryKey}`,
    start: { x: start.x / input.widthPx, y: start.y / input.heightPx },
    end: { x: end.x / input.widthPx, y: end.y / input.heightPx },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: [
        "architectural-line-filter",
        "paired-parallel-edges",
        "strong-mask-rotated-partial-pair",
        "strong-mask-rotated-wall-chain",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

function recoverStrongMaskRotatedPartialPairs(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  segments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): StrongMaskRotatedWallRecoveryResult {
  if (
    input.primaryWalls.length > MAX_WALL_CANDIDATES
    || input.segments.length > MAX_SEGMENTS
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) {
    return {
      walls: [...input.primaryWalls],
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: [],
    };
  }

  const shortSide = Math.min(input.widthPx, input.heightPx);
  const segmentGeometries = input.segments
    .map(segmentGeometry)
    .filter((segment): segment is SegmentGeometry => segment !== null)
    .sort(compareSegmentGeometry);
  const acceptedPixelWalls = input.primaryWalls
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const recovered: RecognitionWallCandidate[] = [];
  const recoveredPixelWalls: PixelWall[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];

  for (let longIndex = 0; longIndex < segmentGeometries.length; longIndex += 1) {
    if (recovered.length >= MAX_PARTIAL_PAIR_RECOVERIES) break;
    const long = segmentGeometries[longIndex]!;
    for (let mateIndex = 0; mateIndex < segmentGeometries.length; mateIndex += 1) {
      if (longIndex === mateIndex) continue;
      const mate = segmentGeometries[mateIndex]!;
      if (mate.lengthPx > long.lengthPx + EPSILON) continue;
      const candidate = partialPairCandidate({
        long,
        mate,
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        shortSide,
      });
      if (!candidate) continue;
      const wall = pixelWall(candidate, input.widthPx, input.heightPx);
      if (!wall) continue;
      if (wall.lengthPx < shortSide * MIN_PARTIAL_PAIR_LONG_LENGTH_SHORT_SIDE_RATIO) continue;
      if (isPhysicalDuplicate(wall, [...acceptedPixelWalls, ...recoveredPixelWalls])) continue;
      if (!anchoredToPrimary(wall, acceptedPixelWalls)) continue;
      const support = maskSupport(wall, input.mask);
      if (support.occupancy < MIN_MASK_OCCUPANCY || support.continuity < MIN_MASK_CONTINUITY) continue;

      recovered.push(candidate);
      recoveredPixelWalls.push(wall);
      diagnostics.push({
        code: "strong-mask-rotated-partial-pair",
        severity: "info",
        message: "Полный диагональный стеновой span восстановлен по длинной границе только после подтверждения частичной парной границы, непрерывного structural mask и связи с принятой сетью стен.",
        candidateId: candidate.id,
      });
      break;
    }
  }

  const byId = new Map<string, RecognitionWallCandidate>();
  for (const candidate of [...input.primaryWalls, ...recovered]) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }
  return {
    walls: [...byId.values()].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls: [...recovered].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredCount: recovered.length,
    diagnostics: diagnostics.sort((first, second) =>
      (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}

export function selectStrongMaskRotatedWallRecoveries(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  replayWalls: readonly RecognitionWallCandidate[];
  mask: StructuralMaskView;
}>): StrongMaskRotatedWallRecoveryResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) {
    return {
      walls: [...input.primaryWalls],
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: [{
        code: "strong-mask-rotated-recovery-invalid-mask",
        severity: "warning",
        message: "Восстановление диагональных structural chains пропущено из-за несовпадающего structural mask.",
        candidateId: null,
      }],
    };
  }
  if (
    input.primaryWalls.length > MAX_WALL_CANDIDATES
    || input.replayWalls.length > MAX_WALL_CANDIDATES
  ) {
    return {
      walls: [...input.primaryWalls],
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: [{
        code: "strong-mask-rotated-recovery-budget-exceeded",
        severity: "warning",
        message: "Восстановление диагональных structural chains пропущено из-за безопасного лимита кандидатов.",
        candidateId: null,
      }],
    };
  }

  const shortSide = Math.min(input.widthPx, input.heightPx);
  const minimumLengthPx = shortSide * MIN_LENGTH_SHORT_SIDE_RATIO;
  const primaryPixelWalls = input.primaryWalls
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const recovered: RecognitionWallCandidate[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];

  for (const candidate of [...input.replayWalls].sort((first, second) => first.id.localeCompare(second.id))) {
    if (candidate.conflict !== null) continue;
    if (!candidate.evidence.reasons.includes("paired-parallel-edges")) continue;
    if (!candidate.evidence.reasons.includes("collinear-centerline-merge")) continue;
    const wall = pixelWall(candidate, input.widthPx, input.heightPx);
    if (!wall) continue;
    if (wall.lengthPx < minimumLengthPx) continue;
    if (axisDelta(wall.angleDeg) < MIN_ROTATED_AXIS_DELTA_DEG) continue;
    if (isPhysicalDuplicate(wall, primaryPixelWalls)) continue;
    if (!anchoredToPrimary(wall, primaryPixelWalls)) continue;
    const support = maskSupport(wall, input.mask);
    if (support.occupancy < MIN_MASK_OCCUPANCY || support.continuity < MIN_MASK_CONTINUITY) continue;

    const accepted = recoveredCandidate(candidate);
    recovered.push(accepted);
    diagnostics.push({
      code: "strong-mask-rotated-wall-chain",
      severity: "info",
      message: "Диагональная стеновая цепочка восстановлена только после подтверждения парных линий, непрерывного structural mask и связи с принятой сетью стен.",
      candidateId: accepted.id,
    });
  }

  const byId = new Map<string, RecognitionWallCandidate>();
  for (const candidate of [...input.primaryWalls, ...recovered]) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }
  return {
    walls: [...byId.values()].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls: [...recovered].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredCount: recovered.length,
    diagnostics: diagnostics.sort((first, second) =>
      (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}

export function recoverStrongMaskRotatedWalls(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  segments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): StrongMaskRotatedWallRecoveryResult {
  if (input.segments.length > MAX_SEGMENTS || input.primaryWalls.length < 1) {
    return {
      walls: [...input.primaryWalls],
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: input.segments.length > MAX_SEGMENTS
        ? [{
            code: "strong-mask-rotated-recovery-segment-budget-exceeded",
            severity: "warning",
            message: "Восстановление диагональных structural chains пропущено из-за безопасного лимита линейных признаков.",
            candidateId: null,
          }]
        : [],
    };
  }

  const shortSide = Math.min(input.widthPx, input.heightPx);
  const replay = analyzeWallCandidates({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    segments: input.segments,
    options: {
      collinearMergeGapPx: clamp(shortSide * 0.12, 120, 180),
      endpointExtensionTolerancePx: clamp(shortSide * 0.045, 32, 64),
    },
  });
  const replayRecovery = selectStrongMaskRotatedWallRecoveries({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    primaryWalls: input.primaryWalls,
    replayWalls: replay.candidates,
    mask: input.mask,
  });
  const partialPairRecovery = recoverStrongMaskRotatedPartialPairs({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    primaryWalls: replayRecovery.walls,
    segments: input.segments,
    mask: input.mask,
  });

  return {
    walls: partialPairRecovery.walls,
    recoveredWalls: [...replayRecovery.recoveredWalls, ...partialPairRecovery.recoveredWalls]
      .sort((first, second) => first.id.localeCompare(second.id)),
    recoveredCount: replayRecovery.recoveredCount + partialPairRecovery.recoveredCount,
    diagnostics: [...replayRecovery.diagnostics, ...partialPairRecovery.diagnostics]
      .sort((first, second) => (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
