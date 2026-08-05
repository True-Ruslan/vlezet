import type { RecognitionWallCandidate } from "./model";
import { recoverSegmentedBoundaryWalls as recoverSegmentedBoundaryWallsBase } from "./segmented-boundary-recovery";
import {
  recoverWindowHostSegmentedWalls as recoverWindowHostSegmentedWallsBase,
  type WindowHostSegmentedRecoveryResult,
} from "./window-host-segmented-recovery";
import type { StructuralMaskView } from "./wall-completion";

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
const MIN_ENCLOSURE_WIDTH_PX = 48;
const MAX_ENCLOSURE_WIDTH_PX = 320;
const ENCLOSURE_OFFSET_STEP_PX = 2;
const MASK_FRAME_ALONG_STEP_PX = 8;
const MASK_FRAME_NORMAL_BAND_PX = 5;
const MIN_MASK_FRAME_SUPPORT_RATIO = 0.9;
const MASK_CLOSURE_ACROSS_STEP_PX = 6;
const MASK_CLOSURE_TANGENT_BAND_PX = 5;
const MASK_CLOSURE_END_SEARCH_PX = 20;
const MIN_MASK_CLOSURE_SUPPORT_RATIO = 0.82;
const MIN_EDGE_DISTANCE_IMPROVEMENT_PX = 8;
const MIN_THICKNESS_INHERITANCE_RATIO = 1.8;
const MAX_TERMINAL_HOST_LENGTH_RATIO = 2.5;
const MAX_TERMINAL_LENGTH_PX = 48;
const PERPENDICULAR_ANCHOR_BAND_ALLOWANCE_PX = 12;
const EPSILON = 1e-7;

type Point = Readonly<{ x: number; y: number }>;
type Interval = Readonly<{ start: number; end: number }>;
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
type RecoveredGroup = Readonly<{
  key: string;
  reference: PixelWall;
  walls: readonly PixelWall[];
}>;

type Input = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  mask: StructuralMaskView;
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

function vectorLength(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function segmentAngle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function pixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  let start = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  let end = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const initialLength = vectorLength(subtract(end, start));
  if (!Number.isFinite(initialLength) || initialLength <= EPSILON) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const vector = subtract(end, start);
  const lengthPx = vectorLength(vector);
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  return {
    candidate,
    start,
    end,
    midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: segmentAngle(start, end),
    thicknessPx: candidate.estimatedThicknessPx ?? 20,
  };
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
  const startOffset = Math.abs(dot(subtract(candidate.start, reference.start), reference.normal));
  const endOffset = Math.abs(dot(subtract(candidate.end, reference.start), reference.normal));
  return Math.max(startOffset, endOffset) <= axisTolerance(reference, candidate);
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

function groupKey(wall: PixelWall): string {
  const angleBucket = Math.round(wall.angleDeg / ANGLE_QUANTUM_DEG);
  const axisBucket = Math.round(dot(wall.midpoint, wall.normal) / AXIS_QUANTUM_PX);
  return `${angleBucket}|${axisBucket}`;
}

function recoveredGroups(
  candidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): RecoveredGroup[] {
  const groups = new Map<string, PixelWall[]>();
  for (const candidate of candidates) {
    const wall = pixelWall(candidate, widthPx, heightPx);
    if (!wall) continue;
    const key = groupKey(wall);
    const group = groups.get(key);
    if (group) group.push(wall);
    else groups.set(key, [wall]);
  }
  return [...groups.entries()].map(([key, walls]) => ({
    key,
    reference: [...walls].sort((first, second) =>
      first.candidate.id.localeCompare(second.candidate.id))[0]!,
    walls: [...walls].sort((first, second) =>
      first.candidate.id.localeCompare(second.candidate.id)),
  })).sort((first, second) => first.key.localeCompare(second.key));
}

function exactWindowHost(candidate: RecognitionWallCandidate): boolean {
  const annotated = candidate as RecognitionWallCandidate & Readonly<{
    windowHostProposalEvidenceList?: readonly unknown[];
  }>;
  return candidate.conflict === null
    && candidate.evidence.reasons.includes("window-symbol-host-bridge")
    && (annotated.windowHostProposalEvidenceList?.length ?? 0) > 0;
}

function activeCollinearWalls(
  group: RecoveredGroup,
  originals: readonly PixelWall[],
): PixelWall[] {
  return originals.filter((wall) =>
    wall.candidate.conflict === null && collinearWith(group.reference, wall));
}

function chainIntervals(
  group: RecoveredGroup,
  originals: readonly PixelWall[],
): Interval[] {
  return mergedIntervals([
    ...activeCollinearWalls(group, originals).map((wall) => intervalOn(group.reference, wall)),
    ...group.walls.map((wall) => intervalOn(group.reference, wall)),
  ]);
}

function architecturalGapCount(intervals: readonly Interval[]): number {
  let count = 0;
  for (let index = 1; index < intervals.length; index += 1) {
    const gap = intervals[index]!.start - intervals[index - 1]!.end;
    if (gap >= MIN_OPENING_GAP_PX && gap <= MAX_OPENING_GAP_PX) count += 1;
  }
  return count;
}

function edgeDistance(point: Point, widthPx: number, heightPx: number): number {
  return Math.min(point.x, widthPx - point.x, point.y, heightPx - point.y);
}

function pointNearExteriorEdge(point: Point, widthPx: number, heightPx: number): boolean {
  const margin = Math.min(
    MAX_EXTERIOR_EDGE_MARGIN_PX,
    Math.min(widthPx, heightPx) * EXTERIOR_EDGE_MARGIN_RATIO,
  );
  return edgeDistance(point, widthPx, heightPx) <= margin;
}

function pointOnReference(
  reference: PixelWall,
  alongPx: number,
  acrossPx: number,
): Point {
  return add(
    reference.start,
    add(scale(reference.tangent, alongPx), scale(reference.normal, acrossPx)),
  );
}

function maskStructuralNear(
  mask: StructuralMaskView,
  point: Point,
  direction: Point,
  halfBandPx: number,
): boolean {
  for (let offset = -halfBandPx; offset <= halfBandPx; offset += 2) {
    const sample = add(point, scale(direction, offset));
    if (mask.isStructural(Math.round(sample.x), Math.round(sample.y))) return true;
  }
  return false;
}

function frameSupportRatio(
  reference: PixelWall,
  chainStart: number,
  chainEnd: number,
  frameOffset: number,
  mask: StructuralMaskView,
): number {
  let supported = 0;
  let total = 0;
  const span = Math.max(1, chainEnd - chainStart);
  const samples = Math.max(3, Math.ceil(span / MASK_FRAME_ALONG_STEP_PX) + 1);
  for (let index = 0; index < samples; index += 1) {
    const along = chainStart + span * index / (samples - 1);
    const point = pointOnReference(reference, along, frameOffset);
    if (maskStructuralNear(mask, point, reference.normal, MASK_FRAME_NORMAL_BAND_PX)) supported += 1;
    total += 1;
  }
  return supported / Math.max(1, total);
}

function closureSupportRatio(
  reference: PixelWall,
  alongPx: number,
  frameOffset: number,
  mask: StructuralMaskView,
): number {
  const distance = Math.abs(frameOffset);
  const samples = Math.max(3, Math.ceil(distance / MASK_CLOSURE_ACROSS_STEP_PX) + 1);
  let supported = 0;
  for (let index = 0; index < samples; index += 1) {
    const across = frameOffset * index / (samples - 1);
    const point = pointOnReference(reference, alongPx, across);
    if (maskStructuralNear(mask, point, reference.tangent, MASK_CLOSURE_TANGENT_BAND_PX)) supported += 1;
  }
  return supported / samples;
}

function closedNearEnd(
  reference: PixelWall,
  endAlongPx: number,
  frameOffset: number,
  mask: StructuralMaskView,
): boolean {
  for (let delta = 0; delta <= MASK_CLOSURE_END_SEARCH_PX; delta += 2) {
    const candidates = delta === 0
      ? [endAlongPx]
      : [endAlongPx - delta, endAlongPx + delta];
    if (candidates.some((along) =>
      closureSupportRatio(reference, along, frameOffset, mask)
      >= MIN_MASK_CLOSURE_SUPPORT_RATIO)) return true;
  }
  return false;
}

function maskBackedFrameOffset(
  group: RecoveredGroup,
  intervals: readonly Interval[],
  input: Input,
): number | null {
  const chainStart = intervals[0]!.start;
  const chainEnd = intervals.at(-1)!.end;
  const hostEdgeDistance = edgeDistance(
    group.reference.midpoint,
    input.widthPx,
    input.heightPx,
  );
  const offsets: number[] = [];
  for (
    let absolute = MIN_ENCLOSURE_WIDTH_PX;
    absolute <= MAX_ENCLOSURE_WIDTH_PX;
    absolute += ENCLOSURE_OFFSET_STEP_PX
  ) {
    offsets.push(-absolute, absolute);
  }

  const eligible = offsets.filter((offset) => {
    const midpoint = pointOnReference(
      group.reference,
      (chainStart + chainEnd) / 2,
      offset,
    );
    const frameEdgeDistance = edgeDistance(midpoint, input.widthPx, input.heightPx);
    if (
      !pointNearExteriorEdge(midpoint, input.widthPx, input.heightPx)
      || frameEdgeDistance > hostEdgeDistance - MIN_EDGE_DISTANCE_IMPROVEMENT_PX
    ) return false;
    if (
      frameSupportRatio(group.reference, chainStart, chainEnd, offset, input.mask)
      < MIN_MASK_FRAME_SUPPORT_RATIO
    ) return false;
    return closedNearEnd(group.reference, chainStart, offset, input.mask)
      && closedNearEnd(group.reference, chainEnd, offset, input.mask);
  });

  return eligible.sort((first, second) =>
    edgeDistance(
      pointOnReference(group.reference, (chainStart + chainEnd) / 2, first),
      input.widthPx,
      input.heightPx,
    ) - edgeDistance(
      pointOnReference(group.reference, (chainStart + chainEnd) / 2, second),
      input.widthPx,
      input.heightPx,
    )
    || Math.abs(first) - Math.abs(second)
    || first - second)[0] ?? null;
}

function nearestExactHost(
  group: RecoveredGroup,
  originals: readonly PixelWall[],
): PixelWall | null {
  const recoveredIntervals = group.walls.map((wall) => intervalOn(group.reference, wall));
  const hosts = activeCollinearWalls(group, originals)
    .filter((wall) => exactWindowHost(wall.candidate));
  return hosts.sort((first, second) => {
    const distanceTo = (host: PixelWall): number => {
      const hostInterval = intervalOn(group.reference, host);
      return Math.min(...recoveredIntervals.map((interval) => {
        if (hostInterval.end < interval.start) return interval.start - hostInterval.end;
        if (interval.end < hostInterval.start) return hostInterval.start - interval.end;
        return 0;
      }));
    };
    return distanceTo(first) - distanceTo(second)
      || first.candidate.id.localeCompare(second.candidate.id);
  })[0] ?? null;
}

function fullyInsidePerpendicularAnchorBand(
  wall: PixelWall,
  originals: readonly PixelWall[],
): boolean {
  return originals.some((anchor) => {
    if (
      anchor.candidate.conflict !== null
      || angleDelta(wall.angleDeg, anchor.angleDeg) < MIN_PERPENDICULAR_ANGLE_DELTA_DEG
    ) return false;
    const anchorVector = subtract(anchor.end, anchor.start);
    const denominator = wall.tangent.x * anchorVector.y - wall.tangent.y * anchorVector.x;
    if (Math.abs(denominator) <= EPSILON) return false;
    const relative = subtract(anchor.start, wall.start);
    const along = (relative.x * anchorVector.y - relative.y * anchorVector.x) / denominator;
    const anchorRatio = (relative.x * wall.tangent.y - relative.y * wall.tangent.x) / denominator;
    if (anchorRatio < -0.05 || anchorRatio > 1.05) return false;
    const allowance = anchor.thicknessPx / 2 + PERPENDICULAR_ANCHOR_BAND_ALLOWANCE_PX;
    return Math.max(Math.abs(along), Math.abs(wall.lengthPx - along)) <= allowance;
  });
}

function geometryId(wall: PixelWall, thicknessPx: number): string {
  return `segmented-boundary-${[
    wall.start.x,
    wall.start.y,
    wall.end.x,
    wall.end.y,
    thicknessPx,
  ].map((value) => Math.round(value * 10)).join("-")}`;
}

function acceptedCandidate(
  wall: PixelWall,
  host: PixelWall,
  originals: readonly PixelWall[],
): RecognitionWallCandidate {
  const maximumTerminalLengthPx = Math.max(
    MAX_TERMINAL_LENGTH_PX,
    host.thicknessPx * MAX_TERMINAL_HOST_LENGTH_RATIO,
  );
  const inheritThickness = wall.lengthPx <= maximumTerminalLengthPx
    && wall.thicknessPx > host.thicknessPx * MIN_THICKNESS_INHERITANCE_RATIO
    && fullyInsidePerpendicularAnchorBand(wall, originals);
  const thicknessPx = inheritThickness ? host.thicknessPx : wall.thicknessPx;
  return {
    ...wall.candidate,
    id: inheritThickness ? geometryId(wall, thicknessPx) : wall.candidate.id,
    estimatedThicknessPx: thicknessPx,
    evidence: {
      ...wall.candidate.evidence,
      reasons: [...new Set([
        ...wall.candidate.evidence.reasons,
        "mask-backed-exterior-frame",
        "parallel-exterior-enclosure",
        "window-host-segmented-continuation",
        ...(inheritThickness ? ["perpendicular-anchor-thickness-inherited"] : []),
      ])].sort(),
    },
  };
}

function recoverMaskBacked(input: Input): WindowHostSegmentedRecoveryResult {
  const base = recoverSegmentedBoundaryWallsBase(input);
  if (base.recoveredWalls.length === 0) {
    return {
      walls: [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id)),
      recoveredWalls: [],
    };
  }
  const originals = input.wallCandidates
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const accepted = new Map<string, RecognitionWallCandidate>();
  for (const group of recoveredGroups(base.recoveredWalls, input.widthPx, input.heightPx)) {
    const host = nearestExactHost(group, originals);
    if (!host) continue;
    const intervals = chainIntervals(group, originals);
    if (
      architecturalGapCount(intervals) < 2
      || maskBackedFrameOffset(group, intervals, input) === null
    ) continue;
    for (const wall of group.walls) {
      const candidate = acceptedCandidate(wall, host, originals);
      accepted.set(candidate.id, candidate);
    }
  }
  const recoveredWalls = [...accepted.values()].sort((first, second) =>
    first.id.localeCompare(second.id));
  return {
    walls: [...input.wallCandidates, ...recoveredWalls]
      .sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls,
  };
}

export function recoverWindowHostSegmentedWalls(
  input: Input,
): WindowHostSegmentedRecoveryResult {
  const activeWallResult = recoverWindowHostSegmentedWallsBase(input);
  if (activeWallResult.recoveredWalls.length > 0) return activeWallResult;
  return recoverMaskBacked(input);
}
