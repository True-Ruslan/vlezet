import type {
  ContinuousDoorHostAnalysisInput,
  ContinuousDoorHostAnalysisResult,
} from "./continuous-door-host-analysis";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

type Point = Readonly<{ x: number; y: number }>;
type WallGeometry = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  thicknessPx: number;
}>;
type TerminalEvidence = Readonly<{
  host: WallGeometry;
  hinge: Point;
  direction: -1 | 1;
  leafLengthPx: number;
  continuationPx: number;
  key: string;
}>;

const MAX_WALL_CANDIDATES = 96;
const MAX_SYMBOL_SEGMENTS = 512;
const MAX_OPENING_HYPOTHESES = 16;
const MIN_DOOR_WIDTH_PX = 30;
const MAX_DOOR_WIDTH_PX = 240;
const MIN_LEAF_WALL_ANGLE_DEG = 70;
const MAX_LEAF_ALONG_DRIFT_RATIO = 0.28;
const MIN_CONTINUATION_PX = 4;
const MIN_CONTINUATION_SUPPORT_RATIO = 0.6;
const MAX_OPENING_SUPPORT_RATIO = 0.28;
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

function angleDeg(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDeltaDeg(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function strongExteriorHost(candidate: RecognitionWallCandidate): boolean {
  const reasons = candidate.evidence.reasons;
  return candidate.conflict === null
    && reasons.includes("topology-edge")
    && reasons.includes("paired-parallel-edges")
    && reasons.includes("primary-structural-component");
}

function geometry(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): WallGeometry | null {
  let start = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  let end = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const rawLength = distance(start, end);
  const thicknessPx = candidate.estimatedThicknessPx;
  if (
    !Number.isFinite(rawLength)
    || rawLength <= EPSILON
    || thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
  ) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const lengthPx = distance(start, end);
  return {
    candidate,
    start,
    end,
    tangent: { x: (end.x - start.x) / lengthPx, y: (end.y - start.y) / lengthPx },
    normal: { x: -(end.y - start.y) / lengthPx, y: (end.x - start.x) / lengthPx },
    lengthPx,
    angleDeg: angleDeg(start, end),
    thicknessPx,
  };
}

function project(point: Point, wall: WallGeometry): Readonly<{ along: number; across: number }> {
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

function insideRaster(point: Point, input: ContinuousDoorHostAnalysisInput): boolean {
  return point.x >= 0
    && point.y >= 0
    && point.x < input.widthPx
    && point.y < input.heightPx;
}

function crossSectionSupport(
  wall: WallGeometry,
  alongPx: number,
  input: ContinuousDoorHostAnalysisInput,
): number {
  const samples = 9;
  const halfSpanPx = Math.max(2, wall.thicknessPx * 0.41);
  let structural = 0;
  for (let index = 0; index < samples; index += 1) {
    const acrossPx = -halfSpanPx + halfSpanPx * 2 * (index + 0.5) / samples;
    const point = pointOnWall(wall, alongPx, acrossPx);
    if (!insideRaster(point, input)) continue;
    if (input.mask.isStructural(Math.floor(point.x), Math.floor(point.y))) structural += 1;
  }
  return structural / samples;
}

function averageSupport(
  wall: WallGeometry,
  startAlongPx: number,
  endAlongPx: number,
  input: ContinuousDoorHostAnalysisInput,
): number {
  const minimum = Math.min(startAlongPx, endAlongPx);
  const maximum = Math.max(startAlongPx, endAlongPx);
  if (maximum - minimum <= EPSILON) return 0;
  const samples = Math.max(3, Math.min(48, Math.ceil((maximum - minimum) / 3)));
  let support = 0;
  for (let index = 0; index < samples; index += 1) {
    const alongPx = minimum + (maximum - minimum) * (index + 0.5) / samples;
    support += crossSectionSupport(wall, alongPx, input);
  }
  return support / samples;
}

function evidenceForSegment(
  wall: WallGeometry,
  segment: DetectedLineSegment,
  input: ContinuousDoorHostAnalysisInput,
): TerminalEvidence | null {
  const firstPoint = { x: segment.x1, y: segment.y1 };
  const secondPoint = { x: segment.x2, y: segment.y2 };
  const leafLengthPx = distance(firstPoint, secondPoint);
  if (
    !Number.isFinite(leafLengthPx)
    || leafLengthPx < MIN_DOOR_WIDTH_PX
    || leafLengthPx > MAX_DOOR_WIDTH_PX
    || angleDeltaDeg(angleDeg(firstPoint, secondPoint), wall.angleDeg) < MIN_LEAF_WALL_ANGLE_DEG
  ) return null;

  const first = project(firstPoint, wall);
  const second = project(secondPoint, wall);
  const [anchorPoint, anchor, free] = Math.abs(first.across) <= Math.abs(second.across)
    ? [firstPoint, first, second] as const
    : [secondPoint, second, first] as const;
  const anchorAcrossTolerancePx = Math.max(8, wall.thicknessPx / 2 + 4);
  if (Math.abs(anchor.across) > anchorAcrossTolerancePx) return null;
  if (Math.abs(free.across) < Math.max(18, leafLengthPx * 0.55)) return null;
  if (Math.abs(free.along - anchor.along) > Math.max(12, leafLengthPx * MAX_LEAF_ALONG_DRIFT_RATIO)) return null;

  const startContinuationPx = -anchor.along;
  const endContinuationPx = anchor.along - wall.lengthPx;
  const startEligible = startContinuationPx >= MIN_CONTINUATION_PX
    && startContinuationPx <= wall.thicknessPx + EPSILON;
  const endEligible = endContinuationPx >= MIN_CONTINUATION_PX
    && endContinuationPx <= wall.thicknessPx + EPSILON;
  if (startEligible === endEligible) return null;

  const direction: -1 | 1 = startEligible ? -1 : 1;
  const terminalAlongPx = startEligible ? 0 : wall.lengthPx;
  const continuationPx = startEligible ? startContinuationPx : endContinuationPx;
  const hingeAlongPx = terminalAlongPx + direction * continuationPx;
  if (averageSupport(wall, terminalAlongPx, hingeAlongPx, input) < MIN_CONTINUATION_SUPPORT_RATIO) return null;

  const openingEndAlongPx = hingeAlongPx + direction * leafLengthPx;
  const openingEnd = pointOnWall(wall, openingEndAlongPx);
  if (!insideRaster(anchorPoint, input) || !insideRaster(openingEnd, input)) return null;
  const openingInsetPx = Math.min(4, leafLengthPx * 0.12);
  const openingStartSample = hingeAlongPx + direction * openingInsetPx;
  const openingEndSample = openingEndAlongPx - direction * openingInsetPx;
  if (averageSupport(wall, openingStartSample, openingEndSample, input) > MAX_OPENING_SUPPORT_RATIO) return null;

  return {
    host: wall,
    hinge: anchorPoint,
    direction,
    leafLengthPx,
    continuationPx,
    key: [
      wall.candidate.id,
      direction,
      Math.round(anchorPoint.x),
      Math.round(anchorPoint.y),
      Math.round(leafLengthPx),
    ].join("|"),
  };
}

function createOpening(
  evidence: TerminalEvidence,
  widthPx: number,
  heightPx: number,
): RecognitionOpeningCandidate {
  const host = evidence.host;
  const hingeAlongPx = evidence.direction < 0
    ? -evidence.continuationPx
    : host.lengthPx + evidence.continuationPx;
  const center = pointOnWall(
    host,
    hingeAlongPx + evidence.direction * evidence.leafLengthPx / 2,
  );
  return {
    id: `exterior-terminal-door-${host.candidate.id}-${Math.round(evidence.hinge.x)}-${Math.round(evidence.hinge.y)}-${Math.round(evidence.leafLengthPx)}`,
    kind: "door",
    hostWallCandidateId: host.candidate.id,
    center: { x: clamp01(center.x / widthPx), y: clamp01(center.y / heightPx) },
    widthPx: evidence.leafLengthPx,
    orientationDeg: host.angleDeg,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.74, Math.max(host.candidate.evidence.localScore ?? 0.68, 0.72)),
      cloudScore: null,
      reasons: [...new Set([
        ...host.candidate.evidence.reasons,
        "continuous-host-mask-door-gap",
        "door-leaf-anchored",
        "exterior-terminal-door-leaf",
        "perpendicular-door-leaf",
        "terminal-host-mask-continuation",
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

function equivalent(first: TerminalEvidence, second: TerminalEvidence): boolean {
  return first.host.candidate.id === second.host.candidate.id
    && first.direction === second.direction
    && distance(first.hinge, second.hinge) <= 12
    && Math.abs(first.leafLengthPx - second.leafLengthPx) <= 16;
}

export function detectExteriorTerminalDoorOpenings(
  input: ContinuousDoorHostAnalysisInput,
): ContinuousDoorHostAnalysisResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) return { openingHypotheses: [], diagnostics: ["exterior-terminal-door-invalid-mask"] };
  if (
    input.wallCandidates.length > MAX_WALL_CANDIDATES
    || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS
  ) return { openingHypotheses: [], diagnostics: ["exterior-terminal-door-budget-exceeded"] };

  const walls = input.wallCandidates
    .filter(strongExteriorHost)
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((candidate) => geometry(candidate, input.widthPx, input.heightPx))
    .filter((candidate): candidate is WallGeometry => candidate !== null);
  const segments = [...input.symbolSegments].sort((first, second) =>
    first.x1 - second.x1
    || first.y1 - second.y1
    || first.x2 - second.x2
    || first.y2 - second.y2);

  const evidence: TerminalEvidence[] = [];
  for (const wall of walls) {
    for (const segment of segments) {
      const candidate = evidenceForSegment(wall, segment, input);
      if (!candidate) continue;
      const existingIndex = evidence.findIndex((existing) => equivalent(existing, candidate));
      if (existingIndex < 0) evidence.push(candidate);
      else if (candidate.key.localeCompare(evidence[existingIndex]!.key) < 0) evidence[existingIndex] = candidate;
      if (evidence.length >= MAX_OPENING_HYPOTHESES) break;
    }
    if (evidence.length >= MAX_OPENING_HYPOTHESES) break;
  }

  const openingHypotheses = evidence
    .sort((first, second) => first.key.localeCompare(second.key))
    .map((candidate) => createOpening(candidate, input.widthPx, input.heightPx));
  const diagnostics = openingHypotheses.length > 0 ? ["exterior-terminal-door-detected"] : [];
  if (openingHypotheses.length >= MAX_OPENING_HYPOTHESES) diagnostics.push("exterior-terminal-door-result-budget-reached");
  return { openingHypotheses, diagnostics };
}
