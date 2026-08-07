import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionDiagnostic, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type StrongMaskRotatedSegmentedPairRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredWalls: readonly RecognitionWallCandidate[];
  recoveredCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type SegmentGeometry = Readonly<{
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
}>;
type PairedFragment = Readonly<{
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  thicknessPx: number;
  angleDeg: number;
  key: string;
}>;
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
type GapRun = Readonly<{
  startRatio: number;
  endRatio: number;
  lengthPx: number;
}>;

const MAX_WALL_CANDIDATES = 128;
const MAX_SEGMENTS = 512;
const MAX_RECOVERIES = 4;
const MIN_ROTATED_AXIS_DELTA_DEG = 20;
const MAX_PAIR_ANGLE_DELTA_DEG = 5;
const MIN_FRAGMENT_LENGTH_SHORT_SIDE_RATIO = 0.08;
const MIN_RAIL_LENGTH_RATIO = 0.75;
const MIN_PROJECTED_OVERLAP_RATIO = 0.9;
const MIN_THICKNESS_PX = 8;
const MAX_THICKNESS_PX = 90;
const MAX_OFFSET_DRIFT_RATIO = 0.15;
const MIN_FRAGMENT_MASK_OCCUPANCY = 0.9;
const MIN_FRAGMENT_MASK_CONTINUITY = 0.9;
const MIN_FULL_LENGTH_SHORT_SIDE_RATIO = 0.35;
const MIN_FRAGMENT_THICKNESS_RATIO = 0.7;
const MIN_GAP_PX = 60;
const MAX_GAP_PX = 240;
const MAX_GAP_FULL_SPAN_RATIO = 0.35;
const MIN_SUPPORTED_SPAN_RATIO = 0.55;
const MAX_AXIS_TOLERANCE_PX = 14;
const MIN_GAP_RUN_PX = 12;
const MAX_ALONG_SAMPLES = 224;
const ACROSS_SAMPLES = 7;
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
  return first.x < second.x || (first.x === second.x && first.y <= second.y)
    ? [first, second]
    : [second, first];
}

function midpoint(start: Point, end: Point): Point {
  return scale(add(start, end), 0.5);
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

function compareSegment(first: SegmentGeometry, second: SegmentGeometry): number {
  return first.start.x - second.start.x
    || first.start.y - second.start.y
    || first.end.x - second.end.x
    || first.end.y - second.end.y
    || first.lengthPx - second.lengthPx;
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const vector = subtract(end, start);
  const lengthSquared = dot(vector, vector);
  if (lengthSquared <= EPSILON) return distance(point, start);
  const ratio = clamp(dot(subtract(point, start), vector) / lengthSquared, 0, 1);
  return distance(point, add(start, scale(vector, ratio)));
}

function pixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  const start = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  const end = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
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
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    thicknessPx,
    angleDeg: angleDeg(start, end),
  };
}

function maskSupport(
  geometry: Readonly<{
    start: Point;
    end: Point;
    normal: Point;
    lengthPx: number;
    thicknessPx: number;
  }>,
  mask: StructuralMaskView,
): Readonly<{ occupancy: number; continuity: number }> {
  const alongSamples = Math.max(24, Math.min(MAX_ALONG_SAMPLES, Math.ceil(geometry.lengthPx / 4)));
  const halfThickness = Math.max(3, geometry.thicknessPx / 2);
  let structuralSamples = 0;
  let totalSamples = 0;
  let currentRun = 0;
  let longestRun = 0;
  const vector = subtract(geometry.end, geometry.start);

  for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
    const alongRatio = (alongIndex + 0.5) / alongSamples;
    const center = add(geometry.start, scale(vector, alongRatio));
    let structuralAcross = 0;
    for (let acrossIndex = 0; acrossIndex < ACROSS_SAMPLES; acrossIndex += 1) {
      const acrossRatio = (acrossIndex + 0.5) / ACROSS_SAMPLES;
      const offset = -halfThickness + 2 * halfThickness * acrossRatio;
      const point = add(center, scale(geometry.normal, offset));
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

function pairedFragment(
  first: SegmentGeometry,
  second: SegmentGeometry,
  shortSide: number,
): PairedFragment | null {
  const [long, mate] = first.lengthPx > second.lengthPx + EPSILON
    ? [first, second]
    : second.lengthPx > first.lengthPx + EPSILON
      ? [second, first]
      : compareSegment(first, second) <= 0 ? [first, second] : [second, first];
  if (long.lengthPx < shortSide * MIN_FRAGMENT_LENGTH_SHORT_SIDE_RATIO) return null;
  if (axisDelta(long.angleDeg) < MIN_ROTATED_AXIS_DELTA_DEG) return null;
  if (angleDelta(long.angleDeg, mate.angleDeg) > MAX_PAIR_ANGLE_DELTA_DEG) return null;
  if (mate.lengthPx / long.lengthPx < MIN_RAIL_LENGTH_RATIO) return null;

  const mateStartAlong = dot(subtract(mate.start, long.start), long.tangent);
  const mateEndAlong = dot(subtract(mate.end, long.start), long.tangent);
  const overlap = Math.max(
    0,
    Math.min(long.lengthPx, Math.max(mateStartAlong, mateEndAlong))
      - Math.max(0, Math.min(mateStartAlong, mateEndAlong)),
  );
  if (overlap / mate.lengthPx < MIN_PROJECTED_OVERLAP_RATIO) return null;

  const firstOffset = dot(subtract(mate.start, long.start), long.normal);
  const secondOffset = dot(subtract(mate.end, long.start), long.normal);
  if (firstOffset * secondOffset <= 0) return null;
  const signedOffset = (firstOffset + secondOffset) / 2;
  const thicknessPx = Math.abs(signedOffset);
  const maximumThicknessPx = Math.min(MAX_THICKNESS_PX, shortSide * 0.08);
  if (thicknessPx < MIN_THICKNESS_PX || thicknessPx > maximumThicknessPx) return null;
  if (Math.abs(firstOffset - secondOffset) > Math.max(3, thicknessPx * MAX_OFFSET_DRIFT_RATIO)) return null;

  const shift = scale(long.normal, signedOffset / 2);
  const trimPx = thicknessPx / 2;
  if (long.lengthPx <= trimPx * 2 + EPSILON) return null;
  const start = add(add(long.start, shift), scale(long.tangent, trimPx));
  const end = add(add(long.end, shift), scale(long.tangent, -trimPx));
  const lengthPx = distance(start, end);
  return {
    start,
    end,
    tangent: long.tangent,
    normal: long.normal,
    lengthPx,
    thicknessPx,
    angleDeg: long.angleDeg,
    key: [start.x, start.y, end.x, end.y, thicknessPx]
      .map((value) => Math.round(value * 10))
      .join("-"),
  };
}

function fragmentsFromSegments(
  segments: readonly SegmentGeometry[],
  shortSide: number,
  mask: StructuralMaskView,
): PairedFragment[] {
  const byKey = new Map<string, PairedFragment>();
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const fragment = pairedFragment(segments[firstIndex]!, segments[secondIndex]!, shortSide);
      if (!fragment) continue;
      const support = maskSupport(fragment, mask);
      if (
        support.occupancy < MIN_FRAGMENT_MASK_OCCUPANCY
        || support.continuity < MIN_FRAGMENT_MASK_CONTINUITY
      ) continue;
      if (!byKey.has(fragment.key)) byKey.set(fragment.key, fragment);
    }
  }
  return [...byKey.values()].sort((first, second) => first.key.localeCompare(second.key));
}

function endpointForProjection(
  fragment: PairedFragment,
  tangent: Point,
  choose: "minimum" | "maximum",
): Point {
  const startProjection = dot(fragment.start, tangent);
  const endProjection = dot(fragment.end, tangent);
  if (choose === "minimum") return startProjection <= endProjection ? fragment.start : fragment.end;
  return startProjection >= endProjection ? fragment.start : fragment.end;
}

function gapRuns(wall: PixelWall, mask: StructuralMaskView): Readonly<{
  gaps: readonly GapRun[];
  supportedRatio: number;
}> {
  const alongSamples = Math.max(32, Math.min(MAX_ALONG_SAMPLES, Math.ceil(wall.lengthPx / 4)));
  const halfThickness = Math.max(3, wall.thicknessPx / 2);
  const supported: boolean[] = [];
  for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
    const alongRatio = (alongIndex + 0.5) / alongSamples;
    const center = add(wall.start, scale(subtract(wall.end, wall.start), alongRatio));
    let structuralAcross = 0;
    for (let acrossIndex = 0; acrossIndex < ACROSS_SAMPLES; acrossIndex += 1) {
      const acrossRatio = (acrossIndex + 0.5) / ACROSS_SAMPLES;
      const offset = -halfThickness + 2 * halfThickness * acrossRatio;
      const point = add(center, scale(wall.normal, offset));
      if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) structuralAcross += 1;
    }
    supported.push(structuralAcross / ACROSS_SAMPLES >= 0.5);
  }

  const gaps: GapRun[] = [];
  let startIndex: number | null = null;
  for (let index = 0; index <= supported.length; index += 1) {
    if (index < supported.length && !supported[index]) {
      if (startIndex === null) startIndex = index;
      continue;
    }
    if (startIndex === null) continue;
    const endIndex = index - 1;
    const startRatio = startIndex / alongSamples;
    const endRatio = (endIndex + 1) / alongSamples;
    const lengthPx = (endRatio - startRatio) * wall.lengthPx;
    if (lengthPx >= MIN_GAP_RUN_PX) gaps.push({ startRatio, endRatio, lengthPx });
    startIndex = null;
  }
  const supportedRatio = supported.filter(Boolean).length / Math.max(1, supported.length);
  return { gaps, supportedRatio };
}

function anchoredToNetwork(wall: PixelWall, network: readonly PixelWall[]): boolean {
  const tolerancePx = Math.max(18, wall.thicknessPx * 1.5);
  return network.some((candidate) =>
    candidate.candidate.conflict === null
    && (
      pointToSegmentDistance(wall.start, candidate.start, candidate.end) <= tolerancePx
      || pointToSegmentDistance(wall.end, candidate.start, candidate.end) <= tolerancePx
    ));
}

function interval(fragment: PairedFragment, tangent: Point): Readonly<{ start: number; end: number }> {
  const first = dot(fragment.start, tangent);
  const second = dot(fragment.end, tangent);
  return { start: Math.min(first, second), end: Math.max(first, second) };
}

function isPhysicalDuplicate(wall: PixelWall, network: readonly PixelWall[]): boolean {
  return network.some((candidate) => {
    if (candidate.candidate.conflict !== null) return false;
    if (angleDelta(wall.angleDeg, candidate.angleDeg) > MAX_DUPLICATE_ANGLE_DELTA_DEG) return false;
    const center = midpoint(wall.start, wall.end);
    const offsetTolerancePx = Math.max(12, Math.min(wall.thicknessPx, candidate.thicknessPx) * 0.6);
    if (pointToSegmentDistance(center, candidate.start, candidate.end) > offsetTolerancePx) return false;
    const candidateStart = dot(subtract(candidate.start, wall.start), wall.tangent);
    const candidateEnd = dot(subtract(candidate.end, wall.start), wall.tangent);
    const overlap = Math.max(
      0,
      Math.min(wall.lengthPx, Math.max(candidateStart, candidateEnd))
        - Math.max(0, Math.min(candidateStart, candidateEnd)),
    );
    return overlap / Math.max(EPSILON, Math.min(wall.lengthPx, candidate.lengthPx)) >= 0.65;
  });
}

function segmentedCandidate(input: Readonly<{
  first: PairedFragment;
  second: PairedFragment;
  widthPx: number;
  heightPx: number;
  shortSide: number;
}>): RecognitionWallCandidate | null {
  if (angleDelta(input.first.angleDeg, input.second.angleDeg) > MAX_PAIR_ANGLE_DELTA_DEG) return null;
  const thicknessRatio = Math.min(input.first.thicknessPx, input.second.thicknessPx)
    / Math.max(input.first.thicknessPx, input.second.thicknessPx);
  if (thicknessRatio < MIN_FRAGMENT_THICKNESS_RATIO) return null;

  const tangent = input.first.tangent;
  const normal = input.first.normal;
  const firstAxis = dot(midpoint(input.first.start, input.first.end), normal);
  const secondAxis = dot(midpoint(input.second.start, input.second.end), normal);
  const axisTolerancePx = Math.max(
    8,
    Math.min(MAX_AXIS_TOLERANCE_PX, Math.min(input.first.thicknessPx, input.second.thicknessPx) * 0.4),
  );
  if (Math.abs(firstAxis - secondAxis) > axisTolerancePx) return null;

  const firstInterval = interval(input.first, tangent);
  const secondInterval = interval(input.second, tangent);
  const ordered = firstInterval.start <= secondInterval.start
    ? [{ fragment: input.first, interval: firstInterval }, { fragment: input.second, interval: secondInterval }]
    : [{ fragment: input.second, interval: secondInterval }, { fragment: input.first, interval: firstInterval }];
  const gapPx = ordered[1]!.interval.start - ordered[0]!.interval.end;
  if (gapPx < MIN_GAP_PX || gapPx > MAX_GAP_PX) return null;

  const start = endpointForProjection(ordered[0]!.fragment, tangent, "minimum");
  const end = endpointForProjection(ordered[1]!.fragment, tangent, "maximum");
  const lengthPx = distance(start, end);
  if (lengthPx < input.shortSide * MIN_FULL_LENGTH_SHORT_SIDE_RATIO) return null;
  if (gapPx / lengthPx > MAX_GAP_FULL_SPAN_RATIO) return null;
  const supportedSpan = input.first.lengthPx + input.second.lengthPx;
  if (supportedSpan / lengthPx < MIN_SUPPORTED_SPAN_RATIO) return null;
  const thicknessPx = (input.first.thicknessPx + input.second.thicknessPx) / 2;

  const geometryKey = [start.x, start.y, end.x, end.y, thicknessPx]
    .map((value) => Math.round(value * 10))
    .join("-");
  return {
    id: `strong-mask-rotated-segmented-${geometryKey}`,
    start: { x: start.x / input.widthPx, y: start.y / input.heightPx },
    end: { x: end.x / input.widthPx, y: end.y / input.heightPx },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: [
        "opening-sized-structural-gap",
        "paired-parallel-edges",
        "strong-mask-rotated-segmented-pair",
        "strong-mask-rotated-wall-chain",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

export function recoverStrongMaskRotatedSegmentedPairs(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  segments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): StrongMaskRotatedSegmentedPairRecoveryResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.primaryWalls.length < 1
    || input.primaryWalls.length > MAX_WALL_CANDIDATES
    || input.segments.length > MAX_SEGMENTS
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) {
    return {
      walls: [...input.primaryWalls].sort((first, second) => first.id.localeCompare(second.id)),
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: [],
    };
  }

  const shortSide = Math.min(input.widthPx, input.heightPx);
  const segments = input.segments
    .map(segmentGeometry)
    .filter((segment): segment is SegmentGeometry => segment !== null)
    .sort(compareSegment);
  const fragments = fragmentsFromSegments(segments, shortSide, input.mask);
  const network = input.primaryWalls
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const recovered: RecognitionWallCandidate[] = [];
  const recoveredPixels: PixelWall[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];

  for (let firstIndex = 0; firstIndex < fragments.length; firstIndex += 1) {
    if (recovered.length >= MAX_RECOVERIES) break;
    for (let secondIndex = firstIndex + 1; secondIndex < fragments.length; secondIndex += 1) {
      const candidate = segmentedCandidate({
        first: fragments[firstIndex]!,
        second: fragments[secondIndex]!,
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        shortSide,
      });
      if (!candidate) continue;
      const wall = pixelWall(candidate, input.widthPx, input.heightPx);
      if (!wall) continue;
      if (!anchoredToNetwork(wall, network)) continue;
      if (isPhysicalDuplicate(wall, [...network, ...recoveredPixels])) continue;
      const profile = gapRuns(wall, input.mask);
      if (profile.supportedRatio < MIN_SUPPORTED_SPAN_RATIO || profile.gaps.length !== 1) continue;
      const gap = profile.gaps[0]!;
      if (
        gap.startRatio <= EPSILON
        || gap.endRatio >= 1 - EPSILON
        || gap.lengthPx < MIN_GAP_PX
        || gap.lengthPx > MAX_GAP_PX
        || gap.lengthPx / wall.lengthPx > MAX_GAP_FULL_SPAN_RATIO
      ) continue;

      recovered.push(candidate);
      recoveredPixels.push(wall);
      diagnostics.push({
        code: "strong-mask-rotated-segmented-pair",
        severity: "info",
        message: "Диагональный host восстановлен из двух парных стеновых фрагментов только после подтверждения единственного opening-sized разрыва structural mask и связи с принятой сетью стен.",
        candidateId: candidate.id,
      });
      if (recovered.length >= MAX_RECOVERIES) break;
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
