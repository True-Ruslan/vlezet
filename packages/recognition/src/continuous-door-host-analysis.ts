import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type ContinuousDoorHostAnalysisInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>;

export type ContinuousDoorHostAnalysisResult = Readonly<{
  openingHypotheses: readonly RecognitionOpeningCandidate[];
  diagnostics: readonly string[];
}>;

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
type GapEvidence = Readonly<{
  startAlongPx: number;
  endAlongPx: number;
  widthPx: number;
  averageSupport: number;
}>;
type DoorEvidence = Readonly<{
  host: WallGeometry;
  gap: GapEvidence;
  leafLengthPx: number;
  key: string;
}>;

const MAX_WALL_CANDIDATES = 96;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_OPENING_HYPOTHESES = 32;
const MIN_DOOR_WIDTH_PX = 30;
const MAX_DOOR_WIDTH_PX = 240;
const MIN_LEAF_WALL_ANGLE_DEG = 65;
const MAX_LEAF_ALONG_DRIFT_RATIO = 0.28;
const MAX_GAP_SUPPORT_RATIO = 0.28;
const STRUCTURAL_CROSS_SECTION_RATIO = 0.45;
const MIN_BOUNDARY_SUPPORT_RATIO = 0.5;
const SCAN_STEP_PX = 2;
const REQUIRED_STRUCTURAL_RUN_SAMPLES = 3;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function angleDeg(start: Point, end: Point): number {
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
  const rawLength = distance(start, end);
  if (!Number.isFinite(rawLength) || rawLength <= EPSILON) return null;
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
    angleDeg: angleDeg(start, end),
    halfThicknessPx: clamp((candidate.estimatedThicknessPx ?? 20) / 2, 2, 80),
  };
}

function projectPoint(point: Point, wall: WallGeometry): Readonly<{ along: number; across: number }> {
  const relative = subtract(point, wall.start);
  return {
    along: dot(relative, wall.tangent),
    across: dot(relative, wall.normal),
  };
}

function pointOnWall(wall: WallGeometry, alongPx: number, acrossPx: number): Point {
  return {
    x: wall.start.x + wall.tangent.x * alongPx + wall.normal.x * acrossPx,
    y: wall.start.y + wall.tangent.y * alongPx + wall.normal.y * acrossPx,
  };
}

function crossSectionSupport(
  wall: WallGeometry,
  alongPx: number,
  mask: StructuralMaskView,
): number {
  const samples = 9;
  const halfSpan = Math.max(2, wall.halfThicknessPx * 0.82);
  let structural = 0;
  for (let index = 0; index < samples; index += 1) {
    const across = -halfSpan + halfSpan * 2 * (index + 0.5) / samples;
    const point = pointOnWall(wall, alongPx, across);
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
    const along = minimum + (maximum - minimum) * (index + 0.5) / sampleCount;
    support += crossSectionSupport(wall, along, mask);
  }
  return support / sampleCount;
}

function scanGapFromAnchor(
  wall: WallGeometry,
  anchorAlongPx: number,
  direction: -1 | 1,
  leafLengthPx: number,
  mask: StructuralMaskView,
): GapEvidence | null {
  const maximumDistance = Math.min(
    MAX_DOOR_WIDTH_PX,
    direction > 0 ? wall.lengthPx - anchorAlongPx : anchorAlongPx,
  );
  if (maximumDistance < MIN_DOOR_WIDTH_PX) return null;

  let consecutiveStructural = 0;
  let firstStructuralAlong: number | null = null;
  for (let distancePx = SCAN_STEP_PX; distancePx <= maximumDistance; distancePx += SCAN_STEP_PX) {
    const along = anchorAlongPx + direction * distancePx;
    const structural = crossSectionSupport(wall, along, mask) >= STRUCTURAL_CROSS_SECTION_RATIO;
    if (structural) {
      consecutiveStructural += 1;
      if (firstStructuralAlong === null) firstStructuralAlong = along;
      if (consecutiveStructural >= REQUIRED_STRUCTURAL_RUN_SAMPLES) break;
    } else {
      consecutiveStructural = 0;
      firstStructuralAlong = null;
    }
  }
  if (consecutiveStructural < REQUIRED_STRUCTURAL_RUN_SAMPLES || firstStructuralAlong === null) return null;

  const gapBoundaryAlong = firstStructuralAlong;
  const startAlongPx = Math.min(anchorAlongPx, gapBoundaryAlong);
  const endAlongPx = Math.max(anchorAlongPx, gapBoundaryAlong);
  const widthPx = endAlongPx - startAlongPx;
  if (widthPx < MIN_DOOR_WIDTH_PX || widthPx > MAX_DOOR_WIDTH_PX) return null;
  if (leafLengthPx < widthPx * 0.45 || leafLengthPx > widthPx * 1.65) return null;

  const inset = Math.min(4, widthPx * 0.12);
  const averageGapSupport = averageSupport(
    wall,
    startAlongPx + inset,
    endAlongPx - inset,
    mask,
  );
  if (averageGapSupport > MAX_GAP_SUPPORT_RATIO) return null;

  const boundaryProbePx = Math.min(18, Math.max(10, widthPx * 0.2));
  const anchorSideStart = anchorAlongPx - direction * boundaryProbePx;
  const anchorSideEnd = anchorAlongPx - direction * 3;
  const farSideStart = gapBoundaryAlong + direction * 3;
  const farSideEnd = gapBoundaryAlong + direction * boundaryProbePx;
  if (
    Math.min(anchorSideStart, anchorSideEnd) < -EPSILON
    || Math.max(anchorSideStart, anchorSideEnd) > wall.lengthPx + EPSILON
    || Math.min(farSideStart, farSideEnd) < -EPSILON
    || Math.max(farSideStart, farSideEnd) > wall.lengthPx + EPSILON
  ) return null;
  if (averageSupport(wall, anchorSideStart, anchorSideEnd, mask) < MIN_BOUNDARY_SUPPORT_RATIO) return null;
  if (averageSupport(wall, farSideStart, farSideEnd, mask) < MIN_BOUNDARY_SUPPORT_RATIO) return null;

  return {
    startAlongPx,
    endAlongPx,
    widthPx,
    averageSupport: averageGapSupport,
  };
}

function evidenceForSegment(
  wall: WallGeometry,
  segment: DetectedLineSegment,
  mask: StructuralMaskView,
): DoorEvidence | null {
  const firstPoint = { x: segment.x1, y: segment.y1 };
  const secondPoint = { x: segment.x2, y: segment.y2 };
  const leafLengthPx = distance(firstPoint, secondPoint);
  if (!Number.isFinite(leafLengthPx) || leafLengthPx < MIN_DOOR_WIDTH_PX || leafLengthPx > MAX_DOOR_WIDTH_PX) {
    return null;
  }
  if (angleDeltaDeg(angleDeg(firstPoint, secondPoint), wall.angleDeg) < MIN_LEAF_WALL_ANGLE_DEG) return null;

  const first = projectPoint(firstPoint, wall);
  const second = projectPoint(secondPoint, wall);
  const [anchor, free] = Math.abs(first.across) <= Math.abs(second.across)
    ? [first, second] as const
    : [second, first] as const;
  const anchorTolerancePx = Math.max(8, wall.halfThicknessPx + 4);
  if (Math.abs(anchor.across) > anchorTolerancePx) return null;
  if (anchor.along < -EPSILON || anchor.along > wall.lengthPx + EPSILON) return null;
  if (Math.abs(free.across) < Math.max(18, leafLengthPx * 0.55)) return null;
  if (Math.abs(free.along - anchor.along) > Math.max(12, leafLengthPx * MAX_LEAF_ALONG_DRIFT_RATIO)) return null;

  const gaps = ([-1, 1] as const)
    .map((direction) => scanGapFromAnchor(wall, anchor.along, direction, leafLengthPx, mask))
    .filter((gap): gap is GapEvidence => gap !== null)
    .sort((firstGap, secondGap) =>
      firstGap.averageSupport - secondGap.averageSupport
      || Math.abs(firstGap.widthPx - leafLengthPx) - Math.abs(secondGap.widthPx - leafLengthPx)
      || firstGap.startAlongPx - secondGap.startAlongPx);
  const gap = gaps[0];
  if (!gap) return null;
  return {
    host: wall,
    gap,
    leafLengthPx,
    key: [
      wall.candidate.id,
      Math.round(gap.startAlongPx),
      Math.round(gap.endAlongPx),
      Math.round(firstPoint.x),
      Math.round(firstPoint.y),
      Math.round(secondPoint.x),
      Math.round(secondPoint.y),
    ].join("|"),
  };
}

function createOpening(evidence: DoorEvidence, widthPx: number, heightPx: number): RecognitionOpeningCandidate {
  const centerAlongPx = (evidence.gap.startAlongPx + evidence.gap.endAlongPx) / 2;
  const center = pointOnWall(evidence.host, centerAlongPx, 0);
  return {
    id: `continuous-door-${evidence.host.candidate.id}-${Math.round(evidence.gap.startAlongPx)}-${Math.round(evidence.gap.endAlongPx)}`,
    kind: "door",
    hostWallCandidateId: evidence.host.candidate.id,
    center: {
      x: clamp01(center.x / widthPx),
      y: clamp01(center.y / heightPx),
    },
    widthPx: evidence.gap.widthPx,
    orientationDeg: evidence.host.angleDeg,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.74, Math.max(evidence.host.candidate.evidence.localScore ?? 0.68, 0.72)),
      cloudScore: null,
      reasons: [...new Set([
        ...evidence.host.candidate.evidence.reasons,
        "continuous-host-mask-door-gap",
        "door-leaf-anchored",
        "perpendicular-door-leaf",
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

function equivalentEvidence(first: DoorEvidence, second: DoorEvidence): boolean {
  return first.host.candidate.id === second.host.candidate.id
    && Math.abs((first.gap.startAlongPx + first.gap.endAlongPx) / 2
      - (second.gap.startAlongPx + second.gap.endAlongPx) / 2) <= 12
    && Math.abs(first.gap.widthPx - second.gap.widthPx) <= 16;
}

export function detectContinuousHostDoorOpenings(
  input: ContinuousDoorHostAnalysisInput,
): ContinuousDoorHostAnalysisResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) {
    return { openingHypotheses: [], diagnostics: ["continuous-host-door-invalid-mask"] };
  }
  if (
    input.wallCandidates.length > MAX_WALL_CANDIDATES
    || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS
  ) {
    return { openingHypotheses: [], diagnostics: ["continuous-host-door-budget-exceeded"] };
  }

  const walls = [...input.wallCandidates]
    .filter((candidate) => candidate.conflict === null)
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((candidate) => canonicalGeometry(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is WallGeometry => wall !== null);
  const segments = [...input.symbolSegments].sort((first, second) =>
    first.x1 - second.x1
    || first.y1 - second.y1
    || first.x2 - second.x2
    || first.y2 - second.y2);

  const evidence: DoorEvidence[] = [];
  for (const wall of walls) {
    for (const segment of segments) {
      const candidate = evidenceForSegment(wall, segment, input.mask);
      if (!candidate) continue;
      const duplicateIndex = evidence.findIndex((existing) => equivalentEvidence(existing, candidate));
      if (duplicateIndex < 0) {
        evidence.push(candidate);
      } else {
        const existing = evidence[duplicateIndex]!;
        if (
          candidate.gap.averageSupport < existing.gap.averageSupport
          || (
            candidate.gap.averageSupport === existing.gap.averageSupport
            && candidate.key.localeCompare(existing.key) < 0
          )
        ) evidence[duplicateIndex] = candidate;
      }
      if (evidence.length >= MAX_OPENING_HYPOTHESES) break;
    }
    if (evidence.length >= MAX_OPENING_HYPOTHESES) break;
  }

  const openingHypotheses = evidence
    .sort((first, second) => first.key.localeCompare(second.key))
    .map((item) => createOpening(item, input.widthPx, input.heightPx))
    .sort((first, second) => first.id.localeCompare(second.id));
  const diagnostics = openingHypotheses.length > 0
    ? ["continuous-host-door-detected"]
    : [];
  if (evidence.length >= MAX_OPENING_HYPOTHESES) diagnostics.push("continuous-host-door-result-budget-reached");
  return { openingHypotheses, diagnostics };
}
