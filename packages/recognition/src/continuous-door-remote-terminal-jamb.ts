import type {
  ContinuousDoorHostAnalysisInput,
  ContinuousDoorHostAnalysisResult,
} from "./continuous-door-host-analysis";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

type Point = Readonly<{ x: number; y: number }>;
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
type ProjectedPoint = Readonly<{ along: number; across: number }>;

const MAX_WALL_CANDIDATES = 96;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_OPENING_HYPOTHESES = 16;
const MIN_DOOR_WIDTH_PX = 30;
const MAX_DOOR_WIDTH_PX = 240;
const MIN_LEAF_WALL_ANGLE_DEG = 65;
const MAX_LEAF_ALONG_DRIFT_RATIO = 0.28;
const MAX_GAP_SUPPORT_RATIO = 0.28;
const MIN_BOUNDARY_SUPPORT_RATIO = 0.5;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function segmentAngleDeg(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDeltaDeg(first: number, second: number): number {
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

function canonicalGeometry(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): WallGeometry | null {
  let start = pixelPoint(candidate, "start", widthPx, heightPx);
  let end = pixelPoint(candidate, "end", widthPx, heightPx);
  const rawLengthPx = distance(start, end);
  if (!Number.isFinite(rawLengthPx) || rawLengthPx <= EPSILON) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const lengthPx = distance(start, end);
  const tangent = {
    x: (end.x - start.x) / lengthPx,
    y: (end.y - start.y) / lengthPx,
  };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: segmentAngleDeg(start, end),
    halfThicknessPx: clamp((candidate.estimatedThicknessPx ?? 20) / 2, 2, 80),
  };
}

function projectPoint(point: Point, wall: WallGeometry): ProjectedPoint {
  const relative = subtract(point, wall.start);
  return {
    along: dot(relative, wall.tangent),
    across: dot(relative, wall.normal),
  };
}

function pointOnWall(wall: WallGeometry, alongPx: number, acrossPx = 0): Point {
  return {
    x: wall.start.x + wall.tangent.x * alongPx + wall.normal.x * acrossPx,
    y: wall.start.y + wall.tangent.y * alongPx + wall.normal.y * acrossPx,
  };
}

function pointInsideRaster(point: Point, widthPx: number, heightPx: number): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < widthPx && point.y < heightPx;
}

function crossSectionSupport(
  wall: WallGeometry,
  alongPx: number,
  mask: StructuralMaskView,
): number {
  const samples = 9;
  const halfSpanPx = Math.max(2, wall.halfThicknessPx * 0.82);
  let structural = 0;
  for (let index = 0; index < samples; index += 1) {
    const acrossPx = -halfSpanPx + halfSpanPx * 2 * (index + 0.5) / samples;
    const point = pointOnWall(wall, alongPx, acrossPx);
    if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) structural += 1;
  }
  return structural / samples;
}

function averageSupport(
  wall: WallGeometry,
  startAlongPx: number,
  endAlongPx: number,
  mask: StructuralMaskView,
): number {
  const minimum = Math.min(startAlongPx, endAlongPx);
  const maximum = Math.max(startAlongPx, endAlongPx);
  if (maximum - minimum <= EPSILON) return 1;
  const sampleCount = Math.max(3, Math.min(48, Math.ceil((maximum - minimum) / 3)));
  let support = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const alongPx = minimum + (maximum - minimum) * (index + 0.5) / sampleCount;
    support += crossSectionSupport(wall, alongPx, mask);
  }
  return support / sampleCount;
}

function openingForRemoteLeaf(
  wall: WallGeometry,
  segment: DetectedLineSegment,
  input: ContinuousDoorHostAnalysisInput,
): RecognitionOpeningCandidate | null {
  const firstPoint = { x: segment.x1, y: segment.y1 };
  const secondPoint = { x: segment.x2, y: segment.y2 };
  const leafLengthPx = distance(firstPoint, secondPoint);
  if (!Number.isFinite(leafLengthPx) || leafLengthPx < MIN_DOOR_WIDTH_PX || leafLengthPx > MAX_DOOR_WIDTH_PX) {
    return null;
  }
  if (angleDeltaDeg(segmentAngleDeg(firstPoint, secondPoint), wall.angleDeg) < MIN_LEAF_WALL_ANGLE_DEG) {
    return null;
  }

  const first = projectPoint(firstPoint, wall);
  const second = projectPoint(secondPoint, wall);
  const [anchor, free] = Math.abs(first.across) <= Math.abs(second.across)
    ? [first, second] as const
    : [second, first] as const;
  const anchorAcrossTolerancePx = Math.max(8, wall.halfThicknessPx + 4);
  if (Math.abs(anchor.across) > anchorAcrossTolerancePx) return null;
  if (Math.abs(free.across) < Math.max(18, leafLengthPx * 0.55)) return null;
  if (Math.abs(free.along - anchor.along) > Math.max(12, leafLengthPx * MAX_LEAF_ALONG_DRIFT_RATIO)) return null;

  const beforeStart = anchor.along < -EPSILON;
  const beyondEnd = anchor.along > wall.lengthPx + EPSILON;
  if (beforeStart === beyondEnd) return null;
  const terminalAlongPx = beforeStart ? 0 : wall.lengthPx;
  const direction: -1 | 1 = beforeStart ? -1 : 1;
  const gapWidthPx = Math.abs(anchor.along - terminalAlongPx);
  if (gapWidthPx < MIN_DOOR_WIDTH_PX || gapWidthPx > MAX_DOOR_WIDTH_PX) return null;
  if (leafLengthPx < gapWidthPx * 0.45 || leafLengthPx > gapWidthPx * 1.65) return null;

  const gapStartAlongPx = Math.min(anchor.along, terminalAlongPx);
  const gapEndAlongPx = Math.max(anchor.along, terminalAlongPx);
  const insetPx = Math.min(4, gapWidthPx * 0.12);
  if (averageSupport(
    wall,
    gapStartAlongPx + insetPx,
    gapEndAlongPx - insetPx,
    input.mask,
  ) > MAX_GAP_SUPPORT_RATIO) return null;

  const boundaryProbePx = Math.min(18, Math.max(10, gapWidthPx * 0.2));
  const hostProbeStart = terminalAlongPx - direction * boundaryProbePx;
  const hostProbeEnd = terminalAlongPx - direction * 3;
  const jambProbeStart = anchor.along + direction * 3;
  const jambProbeEnd = anchor.along + direction * boundaryProbePx;
  const probes = [hostProbeStart, hostProbeEnd, jambProbeStart, jambProbeEnd]
    .map((alongPx) => pointOnWall(wall, alongPx));
  if (probes.some((point) => !pointInsideRaster(point, input.widthPx, input.heightPx))) return null;
  if (averageSupport(wall, hostProbeStart, hostProbeEnd, input.mask) < MIN_BOUNDARY_SUPPORT_RATIO) return null;
  if (averageSupport(wall, jambProbeStart, jambProbeEnd, input.mask) < MIN_BOUNDARY_SUPPORT_RATIO) return null;

  const centerAlongPx = (anchor.along + terminalAlongPx) / 2;
  const center = pointOnWall(wall, centerAlongPx);
  return {
    id: `remote-terminal-door-${wall.candidate.id}-${Math.round(gapStartAlongPx)}-${Math.round(gapEndAlongPx)}`,
    kind: "door",
    hostWallCandidateId: wall.candidate.id,
    center: {
      x: clamp01(center.x / input.widthPx),
      y: clamp01(center.y / input.heightPx),
    },
    widthPx: gapWidthPx,
    orientationDeg: wall.angleDeg,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.74, Math.max(wall.candidate.evidence.localScore ?? 0.68, 0.72)),
      cloudScore: null,
      reasons: [...new Set([
        ...wall.candidate.evidence.reasons,
        "continuous-host-mask-door-gap",
        "door-leaf-anchored",
        "perpendicular-door-leaf",
        "short-terminal-door-jamb-evidence",
        "terminal-host-mask-door-gap",
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

export function detectRemoteTerminalDoorOpenings(
  input: ContinuousDoorHostAnalysisInput,
): ContinuousDoorHostAnalysisResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) return { openingHypotheses: [], diagnostics: ["remote-terminal-door-invalid-mask"] };
  if (input.wallCandidates.length > MAX_WALL_CANDIDATES || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS) {
    return { openingHypotheses: [], diagnostics: ["remote-terminal-door-budget-exceeded"] };
  }

  const walls = [...input.wallCandidates]
    .filter((candidate) => candidate.conflict === null)
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((candidate) => canonicalGeometry(candidate, input.widthPx, input.heightPx))
    .filter((candidate): candidate is WallGeometry => candidate !== null);
  const segments = [...input.symbolSegments].sort((first, second) =>
    first.x1 - second.x1 || first.y1 - second.y1 || first.x2 - second.x2 || first.y2 - second.y2);
  const openings: RecognitionOpeningCandidate[] = [];
  for (const wall of walls) {
    for (const segment of segments) {
      const candidate = openingForRemoteLeaf(wall, segment, input);
      if (!candidate) continue;
      const duplicate = openings.some((existing) =>
        existing.hostWallCandidateId === candidate.hostWallCandidateId
        && Math.hypot(
          (existing.center.x - candidate.center.x) * input.widthPx,
          (existing.center.y - candidate.center.y) * input.heightPx,
        ) <= 12
        && Math.abs((existing.widthPx ?? 0) - (candidate.widthPx ?? 0)) <= 16);
      if (!duplicate) openings.push(candidate);
      if (openings.length >= MAX_OPENING_HYPOTHESES) break;
    }
    if (openings.length >= MAX_OPENING_HYPOTHESES) break;
  }
  const openingHypotheses = openings.sort((first, second) => first.id.localeCompare(second.id));
  const diagnostics = openingHypotheses.length > 0 ? ["remote-terminal-door-detected"] : [];
  if (openingHypotheses.length >= MAX_OPENING_HYPOTHESES) diagnostics.push("remote-terminal-door-result-budget-reached");
  return { openingHypotheses, diagnostics };
}
