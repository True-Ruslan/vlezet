import type { RecognitionWallCandidate } from "./model";
import {
  recoverSegmentedBoundaryWalls as recoverSegmentedBoundaryWallsBase,
  type SegmentedBoundaryRecoveryResult,
} from "./segmented-boundary-recovery";

const MIN_OPENING_GAP_PX = 30;
const MAX_OPENING_GAP_PX = 240;
const MAX_ANGLE_DELTA_DEG = 8;
const MIN_PERPENDICULAR_ANGLE_DELTA_DEG = 70;
const MIN_AXIS_TOLERANCE_PX = 4;
const MAX_AXIS_TOLERANCE_PX = 10;
const MERGE_INTERVAL_TOLERANCE_PX = 4;
const ANGLE_QUANTUM_DEG = 5;
const AXIS_QUANTUM_PX = 8;
const EXTERIOR_EDGE_MARGIN_RATIO = 0.14;
const MAX_EXTERIOR_EDGE_MARGIN_PX = 180;
const MIN_THICKNESS_INHERITANCE_RATIO = 1.8;
const MAX_TERMINAL_HOST_LENGTH_RATIO = 2.5;
const MAX_TERMINAL_LENGTH_PX = 48;
const MIN_UPSTREAM_HOST_LENGTH_PX = 80;
const PERPENDICULAR_ANCHOR_BAND_ALLOWANCE_PX = 12;
const PERPENDICULAR_INTERSECTION_TOLERANCE_PX = 4;
const EPSILON = 1e-7;

type Point = Readonly<{ x: number; y: number }>;
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  midpoint: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  thicknessPx: number;
}>;
type Interval = Readonly<{ start: number; end: number }>;
type RecoveredGroup = Readonly<{
  key: string;
  reference: PixelWall;
  walls: readonly PixelWall[];
}>;
type UpstreamHost = Readonly<{
  wall: PixelWall;
  gapPx: number;
}>;

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

function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

function segmentAngle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  let start = {
    x: candidate.start.x * widthPx,
    y: candidate.start.y * heightPx,
  };
  let end = {
    x: candidate.end.x * widthPx,
    y: candidate.end.y * heightPx,
  };
  const rawVector = subtract(end, start);
  const rawLength = length(rawVector);
  if (!Number.isFinite(rawLength) || rawLength <= EPSILON) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const vector = subtract(end, start);
  const wallLength = length(vector);
  const tangent = { x: vector.x / wallLength, y: vector.y / wallLength };
  return {
    candidate,
    start,
    end,
    midpoint: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    },
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx: wallLength,
    angleDeg: segmentAngle(start, end),
    thicknessPx: candidate.estimatedThicknessPx ?? 20,
  };
}

function groupKey(wall: PixelWall): string {
  const angleBucket = Math.round(wall.angleDeg / ANGLE_QUANTUM_DEG);
  const axisBucket = Math.round(dot(wall.midpoint, wall.normal) / AXIS_QUANTUM_PX);
  return `${angleBucket}|${axisBucket}`;
}

function groupRecoveredWalls(
  recoveredWalls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): RecoveredGroup[] {
  const groups = new Map<string, PixelWall[]>();
  for (const candidate of recoveredWalls) {
    const wall = pixelWall(candidate, widthPx, heightPx);
    if (!wall) continue;
    const key = groupKey(wall);
    const group = groups.get(key);
    if (group) group.push(wall);
    else groups.set(key, [wall]);
  }
  return [...groups.entries()]
    .map(([key, walls]) => ({
      key,
      reference: [...walls].sort((first, second) =>
        first.candidate.id.localeCompare(second.candidate.id))[0]!,
      walls: [...walls].sort((first, second) =>
        first.candidate.id.localeCompare(second.candidate.id)),
    }))
    .sort((first, second) => first.key.localeCompare(second.key));
}

function nearExteriorEdge(
  group: RecoveredGroup,
  widthPx: number,
  heightPx: number,
): boolean {
  const margin = Math.min(
    MAX_EXTERIOR_EDGE_MARGIN_PX,
    Math.min(widthPx, heightPx) * EXTERIOR_EDGE_MARGIN_RATIO,
  );
  const point = group.reference.midpoint;
  return Math.min(
    point.x,
    widthPx - point.x,
    point.y,
    heightPx - point.y,
  ) <= margin;
}

function axisTolerance(first: PixelWall, second: PixelWall): number {
  return Math.max(
    MIN_AXIS_TOLERANCE_PX,
    Math.min(
      MAX_AXIS_TOLERANCE_PX,
      Math.min(first.thicknessPx, second.thicknessPx) * 0.4,
    ),
  );
}

function collinearWith(reference: PixelWall, candidate: PixelWall): boolean {
  if (angleDelta(reference.angleDeg, candidate.angleDeg) > MAX_ANGLE_DELTA_DEG) return false;
  const firstOffset = Math.abs(dot(subtract(candidate.start, reference.start), reference.normal));
  const secondOffset = Math.abs(dot(subtract(candidate.end, reference.start), reference.normal));
  return Math.max(firstOffset, secondOffset) <= axisTolerance(reference, candidate);
}

function intervalOn(reference: PixelWall, candidate: PixelWall): Interval {
  const first = dot(subtract(candidate.start, reference.start), reference.tangent);
  const second = dot(subtract(candidate.end, reference.start), reference.tangent);
  return { start: Math.min(first, second), end: Math.max(first, second) };
}

function mergedIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort((first, second) =>
    first.start - second.start || first.end - second.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end + MERGE_INTERVAL_TOLERANCE_PX) {
      merged.push({ ...interval });
      continue;
    }
    previous.end = Math.max(previous.end, interval.end);
  }
  return merged;
}

function architecturalGapCount(
  group: RecoveredGroup,
  originalWalls: readonly PixelWall[],
): number {
  const collinearOriginals = originalWalls.filter((wall) =>
    wall.candidate.conflict === null && collinearWith(group.reference, wall));
  if (collinearOriginals.length === 0) return 0;
  const intervals = mergedIntervals([
    ...collinearOriginals.map((wall) => intervalOn(group.reference, wall)),
    ...group.walls.map((wall) => intervalOn(group.reference, wall)),
  ]);
  let count = 0;
  for (let index = 1; index < intervals.length; index += 1) {
    const gap = intervals[index]!.start - intervals[index - 1]!.end;
    if (gap >= MIN_OPENING_GAP_PX && gap <= MAX_OPENING_GAP_PX) count += 1;
  }
  return count;
}

function gapFromRecoveredToCandidate(
  recovered: PixelWall,
  candidate: PixelWall,
): number | null {
  const interval = intervalOn(recovered, candidate);
  if (interval.end < 0) return -interval.end;
  if (interval.start > recovered.lengthPx) return interval.start - recovered.lengthPx;
  return null;
}

function nearestUpstreamHost(
  recovered: PixelWall,
  contextWalls: readonly PixelWall[],
): UpstreamHost | null {
  const candidates: UpstreamHost[] = [];
  for (const wall of contextWalls) {
    if (
      wall.candidate.id === recovered.candidate.id
      || wall.candidate.conflict !== null
      || wall.lengthPx < MIN_UPSTREAM_HOST_LENGTH_PX
      || !collinearWith(recovered, wall)
    ) continue;
    const gapPx = gapFromRecoveredToCandidate(recovered, wall);
    if (
      gapPx === null
      || gapPx < MIN_OPENING_GAP_PX
      || gapPx > MAX_OPENING_GAP_PX
    ) continue;
    candidates.push({ wall, gapPx });
  }
  return candidates.sort((first, second) =>
    first.gapPx - second.gapPx
    || first.wall.thicknessPx - second.wall.thicknessPx
    || first.wall.candidate.id.localeCompare(second.wall.candidate.id))[0] ?? null;
}

function intersectionAlongRecovered(
  recovered: PixelWall,
  anchor: PixelWall,
): number | null {
  if (angleDelta(recovered.angleDeg, anchor.angleDeg) < MIN_PERPENDICULAR_ANGLE_DELTA_DEG) return null;
  const anchorStartRelative = subtract(anchor.start, recovered.start);
  const anchorEndRelative = subtract(anchor.end, recovered.start);
  const firstAcross = dot(anchorStartRelative, recovered.normal);
  const secondAcross = dot(anchorEndRelative, recovered.normal);
  const denominator = firstAcross - secondAcross;
  if (Math.abs(denominator) <= EPSILON) return null;
  const ratio = firstAcross / denominator;
  if (ratio < -0.05 || ratio > 1.05) return null;
  const point = add(anchor.start, scale(subtract(anchor.end, anchor.start), ratio));
  const along = dot(subtract(point, recovered.start), recovered.tangent);
  if (
    along < -PERPENDICULAR_INTERSECTION_TOLERANCE_PX
    || along > recovered.lengthPx + PERPENDICULAR_INTERSECTION_TOLERANCE_PX
  ) return null;
  return along;
}

function fullyInsidePerpendicularAnchorBand(
  recovered: PixelWall,
  originalWalls: readonly PixelWall[],
): boolean {
  return originalWalls.some((anchor) => {
    if (anchor.candidate.conflict !== null) return false;
    const intersectionAlong = intersectionAlongRecovered(recovered, anchor);
    if (intersectionAlong === null) return false;
    const bandHalfSpanPx = anchor.thicknessPx / 2 + PERPENDICULAR_ANCHOR_BAND_ALLOWANCE_PX;
    return Math.max(
      Math.abs(intersectionAlong),
      Math.abs(recovered.lengthPx - intersectionAlong),
    ) <= bandHalfSpanPx;
  });
}

function geometryId(
  start: Point,
  end: Point,
  thicknessPx: number,
): string {
  return `segmented-boundary-${[start.x, start.y, end.x, end.y, thicknessPx]
    .map((value) => Math.round(value * 10))
    .join("-")}`;
}

function normalizePerpendicularAnchorThickness(
  candidate: RecognitionWallCandidate,
  contextWalls: readonly PixelWall[],
  originalWalls: readonly PixelWall[],
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  if (!candidate.evidence.reasons.includes("segmented-structural-boundary")) return candidate;
  const recovered = pixelWall(candidate, widthPx, heightPx);
  if (!recovered) return candidate;
  const upstream = nearestUpstreamHost(recovered, contextWalls);
  if (!upstream) return candidate;
  const maximumTerminalLengthPx = Math.max(
    MAX_TERMINAL_LENGTH_PX,
    upstream.wall.thicknessPx * MAX_TERMINAL_HOST_LENGTH_RATIO,
  );
  if (
    recovered.lengthPx > maximumTerminalLengthPx
    || recovered.thicknessPx <= upstream.wall.thicknessPx * MIN_THICKNESS_INHERITANCE_RATIO
    || !fullyInsidePerpendicularAnchorBand(recovered, originalWalls)
  ) return candidate;

  const thicknessPx = upstream.wall.thicknessPx;
  return {
    ...candidate,
    id: geometryId(recovered.start, recovered.end, thicknessPx),
    estimatedThicknessPx: thicknessPx,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "perpendicular-anchor-thickness-inherited",
      ])].sort(),
    },
  };
}

export function recoverSegmentedBoundaryWalls(
  input: Parameters<typeof recoverSegmentedBoundaryWallsBase>[0],
): SegmentedBoundaryRecoveryResult {
  const base = recoverSegmentedBoundaryWallsBase(input);
  if (base.recoveredWalls.length === 0) return base;

  const originalWalls = input.wallCandidates
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const recoveryContextWalls = [...input.wallCandidates, ...base.recoveredWalls]
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const normalizedRecoveredWalls = base.recoveredWalls
    .map((candidate) => normalizePerpendicularAnchorThickness(
      candidate,
      recoveryContextWalls,
      originalWalls,
      input.widthPx,
      input.heightPx,
    ));
  const acceptedGroups = groupRecoveredWalls(
    normalizedRecoveredWalls,
    input.widthPx,
    input.heightPx,
  ).filter((group) =>
    nearExteriorEdge(group, input.widthPx, input.heightPx)
    && architecturalGapCount(group, originalWalls) >= 2);
  const acceptedIds = new Set(
    acceptedGroups.flatMap((group) => group.walls.map((wall) => wall.candidate.id)),
  );
  const recoveredWalls = normalizedRecoveredWalls
    .filter((candidate) => acceptedIds.has(candidate.id))
    .sort((first, second) => first.id.localeCompare(second.id));
  if (recoveredWalls.length === 0) {
    return {
      walls: [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id)),
      recoveredWalls: [],
      acceptedChainCount: 0,
      diagnostics: [],
    };
  }
  return {
    walls: [...input.wallCandidates, ...recoveredWalls]
      .sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls,
    acceptedChainCount: acceptedGroups.length,
    diagnostics: base.diagnostics,
  };
}
