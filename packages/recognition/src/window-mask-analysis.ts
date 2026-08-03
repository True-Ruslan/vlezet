import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type DetectMaskSupportedWindowsInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>;

type Point = Readonly<{ x: number; y: number }>;
type ProjectedRail = Readonly<{
  startAlong: number;
  endAlong: number;
  centerAlong: number;
  across: number;
  lengthPx: number;
}>;
type WallGeometry = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  halfThicknessPx: number;
}>;

const MAX_WALLS = 96;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_WINDOWS = 32;
const AXIS_TOLERANCE_DEG = 10;
const PARALLEL_TOLERANCE_DEG = 8;
const MIN_WINDOW_WIDTH_PX = 28;
const MAX_WINDOW_WIDTH_PX = 240;
const MIN_HOST_SUPPORT_PX = 18;
const LOW_OCCUPANCY_RATIO = 0.36;
const HIGH_OCCUPANCY_RATIO = 0.58;
const MAX_ALONG_SAMPLES = 48;
const MAX_ACROSS_SAMPLES = 13;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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
  let start = pixelPoint(candidate, "start", widthPx, heightPx);
  let end = pixelPoint(candidate, "end", widthPx, heightPx);
  const lengthPx = distance(start, end);
  if (!Number.isFinite(lengthPx) || lengthPx < 80) return null;
  const angleDeg = segmentAngle(start, end);
  const horizontalDelta = Math.min(angleDeg, 180 - angleDeg);
  const verticalDelta = Math.abs(angleDeg - 90);
  if (Math.min(horizontalDelta, verticalDelta) > AXIS_TOLERANCE_DEG) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) < 1e-7 && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const canonicalLength = distance(start, end);
  const tangent = {
    x: (end.x - start.x) / canonicalLength,
    y: (end.y - start.y) / canonicalLength,
  };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx: canonicalLength,
    angleDeg: segmentAngle(start, end),
    halfThicknessPx: Math.max(3, (candidate.estimatedThicknessPx ?? 20) / 2),
  };
}

function projectedRails(
  geometry: WallGeometry,
  segments: readonly DetectedLineSegment[],
): ProjectedRail[] {
  return segments.flatMap((segment): ProjectedRail[] => {
    const start = { x: segment.x1, y: segment.y1 };
    const end = { x: segment.x2, y: segment.y2 };
    const lengthPx = distance(start, end);
    if (!Number.isFinite(lengthPx) || lengthPx < 18 || lengthPx > MAX_WINDOW_WIDTH_PX + 40) return [];
    if (angleDelta(segmentAngle(start, end), geometry.angleDeg) > PARALLEL_TOLERANCE_DEG) return [];
    const startAlong = dot(subtract(start, geometry.start), geometry.tangent);
    const endAlong = dot(subtract(end, geometry.start), geometry.tangent);
    const minimum = Math.min(startAlong, endAlong);
    const maximum = Math.max(startAlong, endAlong);
    if (minimum < -8 || maximum > geometry.lengthPx + 8) return [];
    const midpoint = scale(add(start, end), 0.5);
    const across = dot(subtract(midpoint, geometry.start), geometry.normal);
    if (Math.abs(across) > geometry.halfThicknessPx + 6) return [];
    return [{
      startAlong: minimum,
      endAlong: maximum,
      centerAlong: (minimum + maximum) / 2,
      across,
      lengthPx: maximum - minimum,
    }];
  }).sort((first, second) =>
    first.centerAlong - second.centerAlong
    || first.across - second.across
    || first.startAlong - second.startAlong
    || first.endAlong - second.endAlong);
}

function occupancyRatio(
  geometry: WallGeometry,
  mask: StructuralMaskView,
  startAlong: number,
  endAlong: number,
): number {
  if (endAlong <= startAlong) return 0;
  const alongSamples = Math.max(3, Math.min(
    MAX_ALONG_SAMPLES,
    Math.ceil((endAlong - startAlong) / 3),
  ));
  const acrossSamples = Math.max(5, Math.min(
    MAX_ACROSS_SAMPLES,
    Math.ceil(geometry.halfThicknessPx),
  ));
  let structural = 0;
  let total = 0;
  for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
    const along = startAlong + (endAlong - startAlong) * (alongIndex + 0.5) / alongSamples;
    for (let acrossIndex = 0; acrossIndex < acrossSamples; acrossIndex += 1) {
      const across = -geometry.halfThicknessPx
        + geometry.halfThicknessPx * 2 * (acrossIndex + 0.5) / acrossSamples;
      const point = add(
        geometry.start,
        add(scale(geometry.tangent, along), scale(geometry.normal, across)),
      );
      total += 1;
      if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) structural += 1;
    }
  }
  return structural / Math.max(1, total);
}

function hasDoorLeaf(
  geometry: WallGeometry,
  segments: readonly DetectedLineSegment[],
  gapStart: number,
  gapEnd: number,
): boolean {
  const gapWidth = gapEnd - gapStart;
  const anchorTolerance = Math.max(10, gapWidth * 0.16);
  const acrossTolerance = geometry.halfThicknessPx + 6;
  const minimumLeafDepth = Math.max(18, gapWidth * 0.35);

  for (const segment of segments) {
    const start = { x: segment.x1, y: segment.y1 };
    const end = { x: segment.x2, y: segment.y2 };
    const segmentLength = distance(start, end);
    if (segmentLength < gapWidth * 0.35 || segmentLength > gapWidth * 1.7) continue;
    if (angleDelta(segmentAngle(start, end), geometry.angleDeg) < 65) continue;
    const projected = [start, end].map((point) => ({
      along: dot(subtract(point, geometry.start), geometry.tangent),
      across: dot(subtract(point, geometry.start), geometry.normal),
    }));
    for (const [anchor, leaf] of [[projected[0]!, projected[1]!], [projected[1]!, projected[0]!]] as const) {
      const edgeDistance = Math.min(
        Math.abs(anchor.along - gapStart),
        Math.abs(anchor.along - gapEnd),
      );
      if (
        edgeDistance <= anchorTolerance
        && Math.abs(anchor.across) <= acrossTolerance
        && Math.abs(leaf.across) >= minimumLeafDepth
      ) return true;
    }
  }
  return false;
}

function candidateForPair(
  geometry: WallGeometry,
  first: ProjectedRail,
  second: ProjectedRail,
  input: DetectMaskSupportedWindowsInput,
): RecognitionOpeningCandidate | null {
  const centerDelta = Math.abs(first.centerAlong - second.centerAlong);
  if (centerDelta > 12) return null;
  if (Math.abs(first.startAlong - second.startAlong) > 18) return null;
  if (Math.abs(first.endAlong - second.endAlong) > 18) return null;
  const separation = Math.abs(first.across - second.across);
  if (separation < Math.max(2, geometry.halfThicknessPx * 0.15)) return null;
  if (separation > Math.max(16, geometry.halfThicknessPx * 1.8)) return null;
  if (Math.abs((first.across + second.across) / 2) > Math.max(4, geometry.halfThicknessPx * 0.55)) return null;
  const lengthRatio = Math.min(first.lengthPx, second.lengthPx) / Math.max(first.lengthPx, second.lengthPx);
  if (lengthRatio < 0.75) return null;

  const gapStart = (first.startAlong + second.startAlong) / 2;
  const gapEnd = (first.endAlong + second.endAlong) / 2;
  const widthPx = gapEnd - gapStart;
  if (widthPx < MIN_WINDOW_WIDTH_PX || widthPx > MAX_WINDOW_WIDTH_PX) return null;
  if (gapStart < MIN_HOST_SUPPORT_PX || geometry.lengthPx - gapEnd < MIN_HOST_SUPPORT_PX) return null;
  if (occupancyRatio(geometry, input.mask, gapStart, gapEnd) > LOW_OCCUPANCY_RATIO) return null;
  if (occupancyRatio(geometry, input.mask, gapStart - MIN_HOST_SUPPORT_PX, gapStart) < HIGH_OCCUPANCY_RATIO) return null;
  if (occupancyRatio(geometry, input.mask, gapEnd, gapEnd + MIN_HOST_SUPPORT_PX) < HIGH_OCCUPANCY_RATIO) return null;
  if (hasDoorLeaf(geometry, input.symbolSegments, gapStart, gapEnd)) return null;

  const centerAlong = (gapStart + gapEnd) / 2;
  const centerPoint = add(geometry.start, scale(geometry.tangent, centerAlong));
  const key = [
    geometry.candidate.id,
    Math.round(gapStart),
    Math.round(gapEnd),
  ].join("-");
  return {
    id: `window-mask-${key}`,
    kind: "window",
    hostWallCandidateId: geometry.candidate.id,
    center: {
      x: clamp01(centerPoint.x / input.widthPx),
      y: clamp01(centerPoint.y / input.heightPx),
    },
    widthPx,
    orientationDeg: geometry.angleDeg,
    confidence: "medium",
    evidence: {
      localScore: 0.78,
      cloudScore: null,
      reasons: [
        "host-wall-validated",
        "mask-supported-window-gap",
        "opening-span-validated",
        "paired-window-rails",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

function equivalentOpening(
  first: RecognitionOpeningCandidate,
  second: RecognitionOpeningCandidate,
  widthPx: number,
  heightPx: number,
): boolean {
  if (first.hostWallCandidateId !== second.hostWallCandidateId || first.kind !== second.kind) return false;
  const centerDistance = Math.hypot(
    (first.center.x - second.center.x) * widthPx,
    (first.center.y - second.center.y) * heightPx,
  );
  const firstWidth = first.widthPx ?? 0;
  const secondWidth = second.widthPx ?? 0;
  return centerDistance <= Math.max(12, Math.min(firstWidth, secondWidth) * 0.2)
    && Math.abs(firstWidth - secondWidth) <= Math.max(12, Math.min(firstWidth, secondWidth) * 0.25);
}

export function detectMaskSupportedWindows(
  input: DetectMaskSupportedWindowsInput,
): readonly RecognitionOpeningCandidate[] {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
    || input.wallCandidates.length > MAX_WALLS
    || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS
  ) return [];

  const walls = [...input.wallCandidates]
    .filter((candidate) => candidate.conflict === null)
    .sort((first, second) => first.id.localeCompare(second.id));
  const segments = [...input.symbolSegments].sort((first, second) =>
    first.x1 - second.x1
    || first.y1 - second.y1
    || first.x2 - second.x2
    || first.y2 - second.y2);
  const candidates: RecognitionOpeningCandidate[] = [];

  for (const wall of walls) {
    if (candidates.length >= MAX_WINDOWS) break;
    const geometry = wallGeometry(wall, input.widthPx, input.heightPx);
    if (!geometry) continue;
    const rails = projectedRails(geometry, segments);
    for (let firstIndex = 0; firstIndex < rails.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < rails.length; secondIndex += 1) {
        const candidate = candidateForPair(geometry, rails[firstIndex]!, rails[secondIndex]!, {
          ...input,
          symbolSegments: segments,
        });
        if (!candidate) continue;
        if (candidates.some((existing) => equivalentOpening(
          existing,
          candidate,
          input.widthPx,
          input.heightPx,
        ))) continue;
        candidates.push(candidate);
        if (candidates.length >= MAX_WINDOWS) break;
      }
      if (candidates.length >= MAX_WINDOWS) break;
    }
  }

  return candidates.sort((first, second) => first.id.localeCompare(second.id));
}
