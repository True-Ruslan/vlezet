import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

export type RebindOpeningHypothesesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  hypotheses: readonly RecognitionOpeningCandidate[];
}>;

export type RebindOpeningHypothesesResult = Readonly<{
  hypotheses: readonly RecognitionOpeningCandidate[];
  reboundCount: number;
  diagnostics: readonly string[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  localScore: number;
}>;
type HostMatch = Readonly<{
  wall: PixelWall;
  centerDistancePx: number;
  spanExcessPx: number;
  evidenceCompatibility: number;
}>;

const MAX_WALL_CANDIDATES = 128;
const MAX_HYPOTHESES = 64;
const MAX_ANGLE_DELTA_DEG = 8;
const SPAN_TOLERANCE_PX = 2;
const AMBIGUOUS_DISTANCE_DELTA_PX = 2;
const AMBIGUOUS_SPAN_DELTA_PX = 8;
const AMBIGUOUS_SCORE_DELTA = 0.02;
const EPSILON = 1e-7;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} должен быть положительным конечным числом.`);
  }
  return value;
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

function angleDeg(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pixelPoint(
  point: RecognitionWallCandidate["start"] | RecognitionOpeningCandidate["center"],
  widthPx: number,
  heightPx: number,
): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function toPixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  let start = pixelPoint(candidate.start, widthPx, heightPx);
  let end = pixelPoint(candidate.end, widthPx, heightPx);
  const rawLength = distance(start, end);
  if (!Number.isFinite(rawLength) || rawLength <= EPSILON) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const lengthPx = distance(start, end);
  const tangent = { x: (end.x - start.x) / lengthPx, y: (end.y - start.y) / lengthPx };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: angleDeg(start, end),
    localScore: candidate.evidence.localScore ?? 0,
  };
}

function evidenceCompatibility(
  hypothesis: RecognitionOpeningCandidate,
  wall: RecognitionWallCandidate,
): number {
  const hypothesisReasons = new Set(hypothesis.evidence.reasons);
  const wallReasons = new Set(wall.evidence.reasons);
  if (
    hypothesis.kind === "door"
    && hypothesisReasons.has("door-symbol-host-bridge")
    && wallReasons.has("door-symbol-host-bridge")
  ) return 2;
  if (
    hypothesis.kind === "window"
    && hypothesisReasons.has("window-symbol-host-bridge")
    && wallReasons.has("window-symbol-host-bridge")
  ) return 2;
  if ([...hypothesisReasons].some((reason) => wallReasons.has(reason))) return 1;
  return 0;
}

function hostMatch(
  hypothesis: RecognitionOpeningCandidate,
  wall: PixelWall,
  widthPx: number,
  heightPx: number,
): HostMatch | null {
  const openingWidthPx = hypothesis.widthPx;
  const openingAngle = hypothesis.orientationDeg;
  if (
    openingWidthPx === null
    || !Number.isFinite(openingWidthPx)
    || openingWidthPx <= 0
    || openingAngle === null
    || !Number.isFinite(openingAngle)
  ) return null;
  if (angleDelta(openingAngle, wall.angleDeg) > MAX_ANGLE_DELTA_DEG) return null;

  const center = pixelPoint(hypothesis.center, widthPx, heightPx);
  const relativeCenter = subtract(center, wall.start);
  const centerAlongPx = dot(relativeCenter, wall.tangent);
  const centerDistancePx = Math.abs(dot(relativeCenter, wall.normal));
  const maximumCenterDistancePx = Math.max(
    24,
    (wall.candidate.estimatedThicknessPx ?? 0) / 2 + 4,
  );
  if (centerDistancePx > maximumCenterDistancePx) return null;

  const halfWidthPx = openingWidthPx / 2;
  const openingStartPx = centerAlongPx - halfWidthPx;
  const openingEndPx = centerAlongPx + halfWidthPx;
  if (
    openingStartPx < -SPAN_TOLERANCE_PX
    || openingEndPx > wall.lengthPx + SPAN_TOLERANCE_PX
  ) return null;

  return {
    wall,
    centerDistancePx,
    spanExcessPx: Math.max(0, wall.lengthPx - openingWidthPx),
    evidenceCompatibility: evidenceCompatibility(hypothesis, wall.candidate),
  };
}

function compareMatches(first: HostMatch, second: HostMatch): number {
  return second.evidenceCompatibility - first.evidenceCompatibility
    || first.centerDistancePx - second.centerDistancePx
    || first.spanExcessPx - second.spanExcessPx
    || second.wall.localScore - first.wall.localScore
    || first.wall.candidate.id.localeCompare(second.wall.candidate.id);
}

function ambiguous(first: HostMatch, second: HostMatch): boolean {
  return first.evidenceCompatibility === second.evidenceCompatibility
    && Math.abs(first.centerDistancePx - second.centerDistancePx) <= AMBIGUOUS_DISTANCE_DELTA_PX
    && Math.abs(first.spanExcessPx - second.spanExcessPx) <= AMBIGUOUS_SPAN_DELTA_PX
    && Math.abs(first.wall.localScore - second.wall.localScore) <= AMBIGUOUS_SCORE_DELTA;
}

function reboundHypothesis(
  hypothesis: RecognitionOpeningCandidate,
  wallId: string,
): RecognitionOpeningCandidate {
  return {
    ...hypothesis,
    center: {
      x: clamp01(hypothesis.center.x),
      y: clamp01(hypothesis.center.y),
    },
    hostWallCandidateId: wallId,
    evidence: {
      ...hypothesis.evidence,
      reasons: [...new Set([
        ...hypothesis.evidence.reasons,
        "host-wall-rebound-by-geometry",
      ])].sort(),
    },
  };
}

export function rebindOpeningHypothesesToWalls(
  input: RebindOpeningHypothesesInput,
): RebindOpeningHypothesesResult {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const canonicalHypotheses = [...input.hypotheses]
    .sort((first, second) => first.id.localeCompare(second.id));

  if (
    input.wallCandidates.length > MAX_WALL_CANDIDATES
    || canonicalHypotheses.length > MAX_HYPOTHESES
  ) {
    return {
      hypotheses: canonicalHypotheses,
      reboundCount: 0,
      diagnostics: ["opening-host-rebind-budget-exceeded"],
    };
  }

  const activeWalls = [...input.wallCandidates]
    .filter((candidate) => candidate.conflict === null)
    .sort((first, second) => first.id.localeCompare(second.id));
  const activeIds = new Set(activeWalls.map((candidate) => candidate.id));
  const pixelWalls = activeWalls
    .map((candidate) => toPixelWall(candidate, widthPx, heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const diagnostics = new Set<string>();
  let reboundCount = 0;

  const hypotheses = canonicalHypotheses.map((hypothesis) => {
    if (
      hypothesis.hostWallCandidateId !== null
      && activeIds.has(hypothesis.hostWallCandidateId)
    ) return hypothesis;

    const matches = pixelWalls
      .map((wall) => hostMatch(hypothesis, wall, widthPx, heightPx))
      .filter((match): match is HostMatch => match !== null)
      .sort(compareMatches);
    if (matches.length === 0) {
      diagnostics.add("opening-host-rebind-not-found");
      return hypothesis;
    }
    if (matches.length > 1 && ambiguous(matches[0]!, matches[1]!)) {
      diagnostics.add("opening-host-rebind-ambiguous");
      return hypothesis;
    }

    reboundCount += 1;
    diagnostics.add("opening-host-rebound");
    return reboundHypothesis(hypothesis, matches[0]!.wall.candidate.id);
  });

  return {
    hypotheses,
    reboundCount,
    diagnostics: [...diagnostics].sort(),
  };
}
