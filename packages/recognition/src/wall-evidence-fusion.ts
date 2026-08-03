import type {
  RecognitionDiagnostic,
  RecognitionWallCandidate,
} from "./model";

export type FuseRecognitionWallEvidenceInput = Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  supplementalWalls: readonly RecognitionWallCandidate[];
}>;

export type FuseRecognitionWallEvidenceResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  acceptedSupplementalCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type AxisOrientation = "horizontal" | "vertical" | "diagonal";
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  orientation: AxisOrientation;
  axis: number | null;
  minimum: number;
  maximum: number;
  lengthPx: number;
}>;

const MAX_PRIMARY_WALLS = 96;
const MAX_SUPPLEMENTAL_WALLS = 96;
const MAX_PAIR_COMPARISONS = 4096;
const MAX_ACCEPTED_SUPPLEMENTS = 16;
const AXIS_TOLERANCE_DEG = 10;
const ENDPOINT_ANCHOR_TOLERANCE_PX = 18;
const COLLINEAR_OFFSET_TOLERANCE_PX = 12;
const COLLINEAR_GAP_TOLERANCE_PX = 42;
const DUPLICATE_MIN_OVERLAP_RATIO = 0.72;
const MIN_SUPPLEMENT_LENGTH_PX = 24;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function angleDeg(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function orientation(start: Point, end: Point): AxisOrientation {
  const angle = angleDeg(start, end);
  const horizontalDelta = Math.min(angle, 180 - angle);
  const verticalDelta = Math.abs(angle - 90);
  if (horizontalDelta <= AXIS_TOLERANCE_DEG) return "horizontal";
  if (verticalDelta <= AXIS_TOLERANCE_DEG) return "vertical";
  return "diagonal";
}

function toPixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall {
  const sourceStart = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  const sourceEnd = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const wallOrientation = orientation(sourceStart, sourceEnd);

  if (wallOrientation === "horizontal") {
    const axis = (sourceStart.y + sourceEnd.y) / 2;
    const start = { x: sourceStart.x, y: axis };
    const end = { x: sourceEnd.x, y: axis };
    return {
      candidate,
      start,
      end,
      orientation: wallOrientation,
      axis,
      minimum: Math.min(start.x, end.x),
      maximum: Math.max(start.x, end.x),
      lengthPx: Math.abs(end.x - start.x),
    };
  }

  if (wallOrientation === "vertical") {
    const axis = (sourceStart.x + sourceEnd.x) / 2;
    const start = { x: axis, y: sourceStart.y };
    const end = { x: axis, y: sourceEnd.y };
    return {
      candidate,
      start,
      end,
      orientation: wallOrientation,
      axis,
      minimum: Math.min(start.y, end.y),
      maximum: Math.max(start.y, end.y),
      lengthPx: Math.abs(end.y - start.y),
    };
  }

  return {
    candidate,
    start: sourceStart,
    end: sourceEnd,
    orientation: wallOrientation,
    axis: null,
    minimum: 0,
    maximum: 0,
    lengthPx: distance(sourceStart, sourceEnd),
  };
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function anchoredToPrimaryNetwork(point: Point, primaryWalls: readonly PixelWall[]): boolean {
  return primaryWalls.some((wall) =>
    pointToSegmentDistance(point, wall.start, wall.end) <= ENDPOINT_ANCHOR_TOLERANCE_PX);
}

function intervalOverlap(first: PixelWall, second: PixelWall): number {
  return Math.max(0, Math.min(first.maximum, second.maximum) - Math.max(first.minimum, second.minimum));
}

function physicalDuplicate(candidate: PixelWall, existingWalls: readonly PixelWall[]): boolean {
  if (candidate.orientation === "diagonal" || candidate.axis === null) return false;
  return existingWalls.some((existing) => {
    if (existing.orientation !== candidate.orientation || existing.axis === null) return false;
    if (Math.abs(existing.axis - candidate.axis!) > COLLINEAR_OFFSET_TOLERANCE_PX) return false;
    const overlapRatio = intervalOverlap(candidate, existing)
      / Math.max(1, Math.min(candidate.lengthPx, existing.lengthPx));
    return overlapRatio >= DUPLICATE_MIN_OVERLAP_RATIO;
  });
}

function nearEitherEndpoint(point: Point, wall: PixelWall): boolean {
  return Math.min(distance(point, wall.start), distance(point, wall.end)) <= COLLINEAR_GAP_TOLERANCE_PX;
}

function closesBoundedCollinearGap(candidate: PixelWall, primaryWalls: readonly PixelWall[]): boolean {
  if (candidate.orientation === "diagonal" || candidate.axis === null) return false;
  const collinear = primaryWalls.filter((primary) =>
    primary.orientation === candidate.orientation
    && primary.axis !== null
    && Math.abs(primary.axis - candidate.axis!) <= COLLINEAR_OFFSET_TOLERANCE_PX);
  const startAnchors = collinear.filter((primary) => nearEitherEndpoint(candidate.start, primary));
  const endAnchors = collinear.filter((primary) => nearEitherEndpoint(candidate.end, primary));
  return startAnchors.some((startWall) =>
    endAnchors.some((endWall) => endWall.candidate.id !== startWall.candidate.id));
}

function geometryKey(wall: PixelWall): string {
  const first = wall.orientation === "horizontal"
    ? { x: wall.minimum, y: wall.axis ?? wall.start.y }
    : { x: wall.axis ?? wall.start.x, y: wall.minimum };
  const second = wall.orientation === "horizontal"
    ? { x: wall.maximum, y: wall.axis ?? wall.end.y }
    : { x: wall.axis ?? wall.end.x, y: wall.maximum };
  return [
    wall.orientation,
    Math.round(first.x),
    Math.round(first.y),
    Math.round(second.x),
    Math.round(second.y),
  ].join("-");
}

function normalizedCandidate(
  wall: PixelWall,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const key = geometryKey(wall);
  const horizontal = wall.orientation === "horizontal";
  const start = horizontal
    ? { x: wall.minimum, y: wall.axis! }
    : { x: wall.axis!, y: wall.minimum };
  const end = horizontal
    ? { x: wall.maximum, y: wall.axis! }
    : { x: wall.axis!, y: wall.maximum };
  return {
    ...wall.candidate,
    id: `supplemental-${key}`,
    start: { x: clamp01(start.x / widthPx), y: clamp01(start.y / heightPx) },
    end: { x: clamp01(end.x / widthPx), y: clamp01(end.y / heightPx) },
    confidence: "medium",
    origin: "local",
    conflict: null,
    evidence: {
      ...wall.candidate.evidence,
      reasons: [...new Set([
        ...wall.candidate.evidence.reasons,
        "supplemental-hough-topology-anchor",
      ])].sort(),
    },
  };
}

function supplementalRank(wall: PixelWall): readonly [number, number, string] {
  return [wall.candidate.evidence.localScore ?? 0, wall.lengthPx, wall.candidate.id];
}

function canonicalSupplementOrder(first: PixelWall, second: PixelWall): number {
  const firstRank = supplementalRank(first);
  const secondRank = supplementalRank(second);
  return secondRank[0] - firstRank[0]
    || secondRank[1] - firstRank[1]
    || firstRank[2].localeCompare(secondRank[2]);
}

function budgetExceeded(input: FuseRecognitionWallEvidenceInput): boolean {
  return input.primaryWalls.length > MAX_PRIMARY_WALLS
    || input.supplementalWalls.length > MAX_SUPPLEMENTAL_WALLS
    || input.primaryWalls.length * input.supplementalWalls.length > MAX_PAIR_COMPARISONS;
}

export function fuseRecognitionWallEvidence(
  input: FuseRecognitionWallEvidenceInput,
): FuseRecognitionWallEvidenceResult {
  if (!Number.isFinite(input.widthPx) || input.widthPx <= 0 || !Number.isFinite(input.heightPx) || input.heightPx <= 0) {
    throw new Error("Размер изображения должен быть положительным и конечным.");
  }

  const primaryCandidates = [...input.primaryWalls].sort((first, second) => first.id.localeCompare(second.id));
  if (budgetExceeded(input)) {
    return {
      walls: primaryCandidates,
      acceptedSupplementalCount: 0,
      diagnostics: [{
        code: "wall-evidence-fusion-budget-exceeded",
        severity: "warning",
        message: "Дополнительное восстановление стен пропущено из-за безопасного лимита кандидатов.",
        candidateId: null,
      }],
    };
  }

  const primaryWalls = primaryCandidates.map((candidate) => toPixelWall(candidate, input.widthPx, input.heightPx));
  const supplementalWalls = [...input.supplementalWalls]
    .map((candidate) => toPixelWall(candidate, input.widthPx, input.heightPx))
    .sort(canonicalSupplementOrder);
  const acceptedCandidates: RecognitionWallCandidate[] = [];
  const acceptedPixelWalls: PixelWall[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];

  for (const candidate of supplementalWalls) {
    if (acceptedCandidates.length >= MAX_ACCEPTED_SUPPLEMENTS) break;
    if (candidate.candidate.conflict !== null) continue;
    if (candidate.orientation === "diagonal" || candidate.axis === null) continue;
    if (candidate.lengthPx < MIN_SUPPLEMENT_LENGTH_PX) continue;
    if (physicalDuplicate(candidate, [...primaryWalls, ...acceptedPixelWalls])) continue;

    const independentlyAnchored = anchoredToPrimaryNetwork(candidate.start, primaryWalls)
      && anchoredToPrimaryNetwork(candidate.end, primaryWalls);
    const closesGap = closesBoundedCollinearGap(candidate, primaryWalls);
    if (!independentlyAnchored && !closesGap) continue;

    const accepted = normalizedCandidate(candidate, input.widthPx, input.heightPx);
    acceptedCandidates.push(accepted);
    acceptedPixelWalls.push(toPixelWall(accepted, input.widthPx, input.heightPx));
    diagnostics.push({
      code: "supplemental-hough-topology-anchor",
      severity: "info",
      message: "Дополнительный линейный кандидат принят только после привязки к основной стеновой сети.",
      candidateId: accepted.id,
    });
  }

  const walls = [...primaryCandidates, ...acceptedCandidates]
    .sort((first, second) => first.id.localeCompare(second.id));
  return {
    walls,
    acceptedSupplementalCount: acceptedCandidates.length,
    diagnostics: diagnostics.sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
