import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

type Point = Readonly<{ x: number; y: number }>;
type Direction = "start" | "end";
type HostGeometry = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  thicknessPx: number;
}>;
type RailSegment = Readonly<{
  startAlong: number;
  endAlong: number;
  offsetPx: number;
  lengthPx: number;
}>;
type FaceGap = Readonly<{
  startAlong: number;
  endAlong: number;
  widthPx: number;
  offsetPx: number;
}>;

const MAX_WALL_CANDIDATES = 128;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_RESULTS = 8;
const MIN_RAIL_LENGTH_PX = 18;
const MAX_RAIL_ANGLE_DELTA_DEG = 6;
const MIN_ENTRANCE_WIDTH_TO_THICKNESS_RATIO = 2.75;
const MAX_ENTRANCE_WIDTH_TO_THICKNESS_RATIO = 4.75;
const MIN_FACE_SEPARATION_TO_THICKNESS_RATIO = 0.65;
const MAX_FACE_SEPARATION_TO_THICKNESS_RATIO = 1.45;
const MIN_GAP_WIDTH_SIMILARITY_RATIO = 0.75;
const MAX_GAP_MASK_SUPPORT_RATIO = 0.3;
const EPSILON = 1e-7;

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

function strongWall(candidate: RecognitionWallCandidate): boolean {
  const reasons = candidate.evidence.reasons;
  return candidate.conflict === null
    && reasons.includes("topology-edge")
    && reasons.includes("paired-parallel-edges")
    && reasons.includes("primary-structural-component");
}

function hostGeometry(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): HostGeometry | null {
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
    angleDeg: angleDeg(start, end),
    thicknessPx,
  };
}

function projectSegment(segment: DetectedLineSegment, host: HostGeometry): RailSegment | null {
  const first = { x: segment.x1, y: segment.y1 };
  const second = { x: segment.x2, y: segment.y2 };
  const lengthPx = distance(first, second);
  if (!Number.isFinite(lengthPx) || lengthPx < MIN_RAIL_LENGTH_PX) return null;
  if (angleDelta(angleDeg(first, second), host.angleDeg) > MAX_RAIL_ANGLE_DELTA_DEG) return null;
  const firstRelative = subtract(first, host.start);
  const secondRelative = subtract(second, host.start);
  const firstAlong = dot(firstRelative, host.tangent);
  const secondAlong = dot(secondRelative, host.tangent);
  const offsetPx = (dot(firstRelative, host.normal) + dot(secondRelative, host.normal)) / 2;
  const faceOffsetTolerancePx = Math.max(5, host.thicknessPx * 0.35);
  if (Math.abs(Math.abs(offsetPx) - host.thicknessPx / 2) > faceOffsetTolerancePx) return null;
  return {
    startAlong: Math.min(firstAlong, secondAlong),
    endAlong: Math.max(firstAlong, secondAlong),
    offsetPx,
    lengthPx,
  };
}

function faceGap(
  rails: readonly RailSegment[],
  host: HostGeometry,
  sign: -1 | 1,
  direction: Direction,
): FaceGap | null {
  const face = rails
    .filter((rail) => sign < 0 ? rail.offsetPx < -EPSILON : rail.offsetPx > EPSILON)
    .sort((first, second) => first.startAlong - second.startAlong || first.endAlong - second.endAlong);
  const terminalTolerancePx = Math.max(12, host.thicknessPx * 0.6);
  const minimumNearLengthPx = Math.max(60, host.thicknessPx * 2);
  const candidates: FaceGap[] = [];

  for (const near of face) {
    if (near.lengthPx < minimumNearLengthPx) continue;
    const terminalDistancePx = direction === "end"
      ? Math.abs(near.endAlong - host.lengthPx)
      : Math.abs(near.startAlong);
    if (terminalDistancePx > terminalTolerancePx) continue;

    for (const far of face) {
      if (far === near) continue;
      const startAlong = direction === "end" ? near.endAlong : far.endAlong;
      const endAlong = direction === "end" ? far.startAlong : near.startAlong;
      if (endAlong <= startAlong + EPSILON) continue;
      if (direction === "end" && far.startAlong <= near.endAlong + EPSILON) continue;
      if (direction === "start" && far.endAlong >= near.startAlong - EPSILON) continue;
      const widthPx = endAlong - startAlong;
      const ratio = widthPx / host.thicknessPx;
      if (
        ratio < MIN_ENTRANCE_WIDTH_TO_THICKNESS_RATIO
        || ratio > MAX_ENTRANCE_WIDTH_TO_THICKNESS_RATIO
      ) continue;
      candidates.push({
        startAlong,
        endAlong,
        widthPx,
        offsetPx: (near.offsetPx + far.offsetPx) / 2,
      });
    }
  }

  return candidates.sort((first, second) => {
    const firstTerminal = direction === "end"
      ? Math.abs(first.startAlong - host.lengthPx)
      : Math.abs(first.endAlong);
    const secondTerminal = direction === "end"
      ? Math.abs(second.startAlong - host.lengthPx)
      : Math.abs(second.endAlong);
    return firstTerminal - secondTerminal
      || first.widthPx - second.widthPx
      || first.startAlong - second.startAlong;
  })[0] ?? null;
}

function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const vector = subtract(end, start);
  const lengthSquared = dot(vector, vector);
  if (lengthSquared <= EPSILON) return distance(point, start);
  const ratio = Math.max(0, Math.min(1, dot(subtract(point, start), vector) / lengthSquared));
  const closest = add(start, scale(vector, ratio));
  return distance(point, closest);
}

function hasPerpendicularAnchor(
  host: HostGeometry,
  terminal: Point,
  wallCandidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): boolean {
  const tolerancePx = Math.max(10, host.thicknessPx * 0.55);
  return wallCandidates.some((candidate) => {
    if (candidate.id === host.candidate.id || !strongWall(candidate)) return false;
    const other = hostGeometry(candidate, widthPx, heightPx);
    return other !== null
      && angleDelta(host.angleDeg, other.angleDeg) >= 70
      && pointSegmentDistance(terminal, other.start, other.end) <= tolerancePx;
  });
}

function gapMaskSupport(
  host: HostGeometry,
  startAlong: number,
  endAlong: number,
  mask: StructuralMaskView,
): number {
  const insetPx = Math.min(5, Math.max(2, (endAlong - startAlong) * 0.08));
  const start = startAlong + insetPx;
  const end = endAlong - insetPx;
  if (end <= start + EPSILON) return 1;
  const samples = 25;
  let supported = 0;
  for (let index = 0; index < samples; index += 1) {
    const along = start + (end - start) * (index + 0.5) / samples;
    const point = add(host.start, scale(host.tangent, along));
    if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) supported += 1;
  }
  return supported / samples;
}

function candidateForDirection(
  host: HostGeometry,
  rails: readonly RailSegment[],
  direction: Direction,
  input: Readonly<{
    widthPx: number;
    heightPx: number;
    wallCandidates: readonly RecognitionWallCandidate[];
    mask: StructuralMaskView;
  }>,
): RecognitionOpeningCandidate | null {
  const negative = faceGap(rails, host, -1, direction);
  const positive = faceGap(rails, host, 1, direction);
  if (!negative || !positive) return null;

  const faceSeparationPx = Math.abs(positive.offsetPx - negative.offsetPx);
  const faceRatio = faceSeparationPx / host.thicknessPx;
  if (
    faceRatio < MIN_FACE_SEPARATION_TO_THICKNESS_RATIO
    || faceRatio > MAX_FACE_SEPARATION_TO_THICKNESS_RATIO
  ) return null;
  const alignmentTolerancePx = Math.max(12, host.thicknessPx * 0.45);
  if (
    Math.abs(negative.startAlong - positive.startAlong) > alignmentTolerancePx
    || Math.abs(negative.endAlong - positive.endAlong) > alignmentTolerancePx
  ) return null;
  const widthSimilarity = Math.min(negative.widthPx, positive.widthPx)
    / Math.max(negative.widthPx, positive.widthPx);
  if (widthSimilarity < MIN_GAP_WIDTH_SIMILARITY_RATIO) return null;

  const gapStartAlong = (negative.startAlong + positive.startAlong) / 2;
  const gapEndAlong = (negative.endAlong + positive.endAlong) / 2;
  const gapWidthPx = gapEndAlong - gapStartAlong;
  const terminalAlong = direction === "end" ? host.lengthPx : 0;
  const nearGapEdge = direction === "end" ? gapStartAlong : gapEndAlong;
  if (Math.abs(nearGapEdge - terminalAlong) > Math.max(12, host.thicknessPx * 0.6)) return null;
  const scaleRatio = gapWidthPx / host.thicknessPx;
  if (
    scaleRatio < MIN_ENTRANCE_WIDTH_TO_THICKNESS_RATIO
    || scaleRatio > MAX_ENTRANCE_WIDTH_TO_THICKNESS_RATIO
  ) return null;
  if (gapMaskSupport(host, gapStartAlong, gapEndAlong, input.mask) > MAX_GAP_MASK_SUPPORT_RATIO) return null;

  const terminal = direction === "end" ? host.end : host.start;
  if (!hasPerpendicularAnchor(
    host,
    terminal,
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  )) return null;

  const centerAlong = (gapStartAlong + gapEndAlong) / 2;
  const center = add(host.start, scale(host.tangent, centerAlong));
  return {
    id: `paired-boundary-door-${host.candidate.id}-${direction}-${Math.round(center.x)}-${Math.round(center.y)}-${Math.round(gapWidthPx)}`,
    kind: "door",
    hostWallCandidateId: host.candidate.id,
    center: { x: center.x / input.widthPx, y: center.y / input.heightPx },
    widthPx: gapWidthPx,
    orientationDeg: host.angleDeg,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.74, Math.max(host.candidate.evidence.localScore ?? 0.68, 0.72)),
      cloudScore: null,
      reasons: [...new Set([
        ...host.candidate.evidence.reasons,
        "paired-boundary-door-gap",
        "paired-boundary-rails",
        "perpendicular-structural-anchor",
        "terminal-host-mask-door-gap",
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

export function detectPairedBoundaryDoorGaps(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): RecognitionOpeningCandidate[] {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
    || input.wallCandidates.length > MAX_WALL_CANDIDATES
    || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS
  ) return [];

  const results: RecognitionOpeningCandidate[] = [];
  const hosts = input.wallCandidates
    .filter(strongWall)
    .sort((first, second) => first.id.localeCompare(second.id));
  for (const candidate of hosts) {
    const host = hostGeometry(candidate, input.widthPx, input.heightPx);
    if (!host) continue;
    const rails = input.symbolSegments
      .map((segment) => projectSegment(segment, host))
      .filter((segment): segment is RailSegment => segment !== null);
    if (rails.length < 4) continue;
    for (const direction of ["start", "end"] as const) {
      const opening = candidateForDirection(host, rails, direction, input);
      if (opening) results.push(opening);
      if (results.length >= MAX_RESULTS) return results.sort((a, b) => a.id.localeCompare(b.id));
    }
  }
  return results.sort((a, b) => a.id.localeCompare(b.id));
}
