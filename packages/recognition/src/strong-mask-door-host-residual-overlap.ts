import type {
  RecognitionDiagnostic,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";

export type StrongMaskDoorHostResidualOverlapResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  blockedCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  thicknessPx: number;
  angleDeg: number;
}>;

const MAX_WALL_CANDIDATES = 128;
const MAX_OPENING_CANDIDATES = 64;
const MAX_ANGLE_DELTA_DEG = 8;
const MIN_RESIDUAL_COVERAGE = 0.9;
const MAX_RESIDUAL_TO_HOST_LENGTH_RATIO = 0.6;
const MAX_AXIS_OFFSET_THICKNESS_RATIO = 0.35;
const EPSILON = 1e-7;

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function angleDeg(start: Point, end: Point): number {
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
  let start = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  let end = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const thicknessPx = candidate.estimatedThicknessPx;
  if (
    thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
    || ![start.x, start.y, end.x, end.y].every(Number.isFinite)
  ) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (lengthPx <= EPSILON) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    thicknessPx,
    angleDeg: angleDeg(start, end),
  };
}

function projectedInterval(
  reference: PixelWall,
  candidate: PixelWall,
): Readonly<{ start: number; end: number; offsetPx: number }> {
  const first = subtract(candidate.start, reference.start);
  const second = subtract(candidate.end, reference.start);
  const firstAlong = dot(first, reference.tangent);
  const secondAlong = dot(second, reference.tangent);
  return {
    start: Math.min(firstAlong, secondAlong),
    end: Math.max(firstAlong, secondAlong),
    offsetPx: (dot(first, reference.normal) + dot(second, reference.normal)) / 2,
  };
}

function isStrongDoorHost(wall: PixelWall): boolean {
  return wall.candidate.conflict === null
    && wall.candidate.evidence.reasons.includes("strong-mask-rotated-door-host");
}

function isResidualCandidate(wall: PixelWall): boolean {
  return wall.candidate.conflict === null
    && wall.candidate.evidence.reasons.includes("topology-edge")
    && !wall.candidate.evidence.reasons.includes("strong-mask-rotated-door-host")
    && !wall.candidate.evidence.reasons.includes("door-host-residual");
}

function referencedByActiveOpening(
  wallId: string,
  openings: readonly RecognitionOpeningCandidate[],
): boolean {
  return openings.some((candidate) =>
    candidate.conflict === null && candidate.hostWallCandidateId === wallId);
}

function isContainedResidual(residual: PixelWall, host: PixelWall): boolean {
  if (residual.lengthPx > host.lengthPx * MAX_RESIDUAL_TO_HOST_LENGTH_RATIO) return false;
  if (angleDelta(residual.angleDeg, host.angleDeg) > MAX_ANGLE_DELTA_DEG) return false;
  const interval = projectedInterval(host, residual);
  const overlapPx = Math.max(
    0,
    Math.min(host.lengthPx, interval.end) - Math.max(0, interval.start),
  );
  if (overlapPx / residual.lengthPx < MIN_RESIDUAL_COVERAGE) return false;
  const offsetTolerancePx = Math.max(
    4,
    Math.min(host.thicknessPx, residual.thicknessPx) * MAX_AXIS_OFFSET_THICKNESS_RATIO,
  );
  return Math.abs(interval.offsetPx) <= offsetTolerancePx;
}

function blockedResidual(candidate: RecognitionWallCandidate): RecognitionWallCandidate {
  return {
    ...candidate,
    confidence: "low",
    conflict: "unsupported",
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.5, 0.5),
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "strong-mask-door-host-residual-overlap-veto",
      ])].sort(),
    },
  };
}

export function cleanupStrongMaskDoorHostResidualOverlaps(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  openings: readonly RecognitionOpeningCandidate[];
}>): StrongMaskDoorHostResidualOverlapResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.wallCandidates.length > MAX_WALL_CANDIDATES
    || input.openings.length > MAX_OPENING_CANDIDATES
  ) {
    return { walls: [...input.wallCandidates], blockedCount: 0, diagnostics: [] };
  }

  const pixels = input.wallCandidates
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const hosts = pixels
    .filter(isStrongDoorHost)
    .sort((first, second) => first.candidate.id.localeCompare(second.candidate.id));
  if (hosts.length === 0) {
    return { walls: [...input.wallCandidates], blockedCount: 0, diagnostics: [] };
  }

  const blockedIds = new Set<string>();
  for (const residual of pixels
    .filter(isResidualCandidate)
    .sort((first, second) => first.candidate.id.localeCompare(second.candidate.id))) {
    if (referencedByActiveOpening(residual.candidate.id, input.openings)) continue;
    if (hosts.some((host) => isContainedResidual(residual, host))) blockedIds.add(residual.candidate.id);
  }
  if (blockedIds.size === 0) {
    return { walls: [...input.wallCandidates], blockedCount: 0, diagnostics: [] };
  }

  return {
    walls: input.wallCandidates.map((candidate) =>
      blockedIds.has(candidate.id) ? blockedResidual(candidate) : candidate),
    blockedCount: blockedIds.size,
    diagnostics: [...blockedIds].sort().map((candidateId) => ({
      code: "strong-mask-door-host-residual-overlap-veto",
      severity: "info",
      message: "Короткий topology residual почти полностью перекрыт доказанным strong-mask door host на той же физической оси и оставлен только для диагностики.",
      candidateId,
    })),
  };
}
