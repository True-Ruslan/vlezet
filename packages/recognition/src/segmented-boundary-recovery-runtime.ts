import type { RecognitionWallCandidate } from "./model";
import {
  recoverSegmentedBoundaryWalls as recoverSegmentedBoundaryWallsBase,
  type SegmentedBoundaryRecoveryResult,
} from "./segmented-boundary-recovery";

const MIN_OPENING_GAP_PX = 30;
const MAX_OPENING_GAP_PX = 240;
const MAX_ANGLE_DELTA_DEG = 8;
const MIN_AXIS_TOLERANCE_PX = 4;
const MAX_AXIS_TOLERANCE_PX = 10;
const MERGE_INTERVAL_TOLERANCE_PX = 4;
const ANGLE_QUANTUM_DEG = 5;
const AXIS_QUANTUM_PX = 8;
const EPSILON = 1e-7;

type Point = Readonly<{ x: number; y: number }>;
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  midpoint: Point;
  tangent: Point;
  normal: Point;
  angleDeg: number;
  thicknessPx: number;
}>;
type Interval = Readonly<{ start: number; end: number }>;
type RecoveredGroup = Readonly<{
  key: string;
  reference: PixelWall;
  walls: readonly PixelWall[];
}>;

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
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

export function recoverSegmentedBoundaryWalls(
  input: Parameters<typeof recoverSegmentedBoundaryWallsBase>[0],
): SegmentedBoundaryRecoveryResult {
  const base = recoverSegmentedBoundaryWallsBase(input);
  if (base.recoveredWalls.length === 0) return base;

  const originalWalls = input.wallCandidates
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const acceptedGroups = groupRecoveredWalls(
    base.recoveredWalls,
    input.widthPx,
    input.heightPx,
  ).filter((group) => architecturalGapCount(group, originalWalls) >= 2);
  const acceptedIds = new Set(
    acceptedGroups.flatMap((group) => group.walls.map((wall) => wall.candidate.id)),
  );
  const recoveredWalls = base.recoveredWalls
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
