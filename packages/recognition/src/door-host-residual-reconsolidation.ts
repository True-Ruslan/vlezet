import type {
  RecognitionDiagnostic,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";

export type DoorHostResidualReconsolidationResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  openings: readonly RecognitionOpeningCandidate[];
  reconsolidatedCount: number;
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
  angleDeg: number;
  thicknessPx: number;
}>;

const MAX_WALL_CANDIDATES = 128;
const MAX_OPENING_CANDIDATES = 64;
const MAX_ANGLE_DELTA_DEG = 8;
const MIN_SPLIT_FRAGMENT_PX = 20;
const EPSILON = 1e-7;

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} должен быть положительным конечным числом.`);
  return value;
}

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

function pixelPoint(
  point: RecognitionWallCandidate["start"] | RecognitionOpeningCandidate["center"],
  widthPx: number,
  heightPx: number,
): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function pixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  let start = pixelPoint(candidate.start, widthPx, heightPx);
  let end = pixelPoint(candidate.end, widthPx, heightPx);
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
  const tangent = { x: (end.x - start.x) / lengthPx, y: (end.y - start.y) / lengthPx };
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

function projectedInterval(reference: PixelWall, wall: PixelWall): Readonly<{ start: number; end: number; offsetPx: number }> {
  const first = subtract(wall.start, reference.start);
  const second = subtract(wall.end, reference.start);
  const firstAlong = dot(first, reference.tangent);
  const secondAlong = dot(second, reference.tangent);
  return {
    start: Math.min(firstAlong, secondAlong),
    end: Math.max(firstAlong, secondAlong),
    offsetPx: (dot(first, reference.normal) + dot(second, reference.normal)) / 2,
  };
}

function hasExternalNeighbor(
  residual: PixelWall,
  walls: readonly PixelWall[],
  side: "start" | "end",
): boolean {
  const endpointTolerancePx = Math.max(4, residual.thicknessPx * 0.2);
  const offsetTolerancePx = Math.max(4, residual.thicknessPx * 0.25);
  return walls.some((wall) => {
    if (
      wall.candidate.id === residual.candidate.id
      || wall.candidate.conflict !== null
      || wall.candidate.evidence.reasons.includes("door-host-residual")
      || angleDelta(residual.angleDeg, wall.angleDeg) > MAX_ANGLE_DELTA_DEG
    ) return false;
    const interval = projectedInterval(residual, wall);
    if (Math.abs(interval.offsetPx) > offsetTolerancePx) return false;
    return side === "start"
      ? Math.abs(interval.end) <= endpointTolerancePx && interval.start < -endpointTolerancePx
      : Math.abs(interval.start - residual.lengthPx) <= endpointTolerancePx
        && interval.end > residual.lengthPx + endpointTolerancePx;
  });
}

function hostedDoor(
  residual: PixelWall,
  openings: readonly RecognitionOpeningCandidate[],
  widthPx: number,
  heightPx: number,
): Readonly<{
  candidate: RecognitionOpeningCandidate;
  startAlong: number;
  endAlong: number;
}> | null {
  const hosted = openings.filter((candidate) =>
    candidate.conflict === null
    && candidate.kind === "door"
    && candidate.hostWallCandidateId === residual.candidate.id
    && candidate.evidence.reasons.includes("host-wall-validated")
    && candidate.evidence.reasons.includes("opening-span-validated"));
  if (hosted.length !== 1) return null;
  const candidate = hosted[0]!;
  if (
    candidate.widthPx === null
    || !Number.isFinite(candidate.widthPx)
    || candidate.widthPx <= 0
    || candidate.orientationDeg === null
    || !Number.isFinite(candidate.orientationDeg)
    || angleDelta(candidate.orientationDeg, residual.angleDeg) > MAX_ANGLE_DELTA_DEG
  ) return null;
  const center = pixelPoint(candidate.center, widthPx, heightPx);
  const relative = subtract(center, residual.start);
  const centerAcross = Math.abs(dot(relative, residual.normal));
  if (centerAcross > Math.max(8, residual.thicknessPx * 0.5)) return null;
  const centerAlong = dot(relative, residual.tangent);
  const halfWidth = candidate.widthPx / 2;
  const startAlong = centerAlong - halfWidth;
  const endAlong = centerAlong + halfWidth;
  if (
    startAlong < MIN_SPLIT_FRAGMENT_PX
    || residual.lengthPx - endAlong < MIN_SPLIT_FRAGMENT_PX
  ) return null;
  return { candidate, startAlong, endAlong };
}

function normalizedPoint(point: Point, widthPx: number, heightPx: number): RecognitionWallCandidate["start"] {
  return { x: point.x / widthPx, y: point.y / heightPx };
}

function splitWall(
  residual: PixelWall,
  id: string,
  startAlong: number,
  endAlong: number,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const start = add(residual.start, scale(residual.tangent, startAlong));
  const end = add(residual.start, scale(residual.tangent, endAlong));
  return {
    ...residual.candidate,
    id,
    start: normalizedPoint(start, widthPx, heightPx),
    end: normalizedPoint(end, widthPx, heightPx),
    conflict: null,
    evidence: {
      ...residual.candidate.evidence,
      reasons: [...new Set([
        ...residual.candidate.evidence.reasons.filter((reason) => reason !== "door-host-residual"),
        "door-host-residual-split",
      ])].sort(),
    },
  };
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
        "door-host-residual-reconsolidated",
      ])].sort(),
    },
  };
}

function reboundOpening(
  candidate: RecognitionOpeningCandidate,
  hostWallCandidateId: string,
): RecognitionOpeningCandidate {
  return {
    ...candidate,
    hostWallCandidateId,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "door-host-residual-reconsolidated",
      ])].sort(),
    },
  };
}

export function reconsolidateDoorHostResiduals(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  openings: readonly RecognitionOpeningCandidate[];
}>): DoorHostResidualReconsolidationResult {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  if (
    input.wallCandidates.length > MAX_WALL_CANDIDATES
    || input.openings.length > MAX_OPENING_CANDIDATES
  ) {
    return {
      walls: [...input.wallCandidates],
      openings: [...input.openings],
      reconsolidatedCount: 0,
      diagnostics: [{
        code: "door-host-residual-reconsolidation-budget-exceeded",
        severity: "warning",
        message: "Повторная консолидация остаточных дверных host-стен пропущена из-за безопасного лимита кандидатов.",
        candidateId: null,
      }],
    };
  }

  const pixelWalls = input.wallCandidates
    .map((candidate) => pixelWall(candidate, widthPx, heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const existingIds = new Set(input.wallCandidates.map((candidate) => candidate.id));
  const replacements = new Map<string, readonly RecognitionWallCandidate[]>();
  const openingRebinds = new Map<string, string>();
  const diagnostics: RecognitionDiagnostic[] = [];

  for (const residual of pixelWalls) {
    if (
      residual.candidate.conflict !== null
      || !residual.candidate.evidence.reasons.includes("door-host-residual")
      || !residual.candidate.evidence.reasons.includes("door-symbol-host-bridge")
    ) continue;
    const opening = hostedDoor(residual, input.openings, widthPx, heightPx);
    if (!opening) continue;
    if (
      !hasExternalNeighbor(residual, pixelWalls, "start")
      || !hasExternalNeighbor(residual, pixelWalls, "end")
    ) continue;

    const beforeId = `${residual.candidate.id}-split-before`;
    const afterId = `${residual.candidate.id}-split-after`;
    if (existingIds.has(beforeId) || existingIds.has(afterId)) continue;
    const before = splitWall(residual, beforeId, 0, opening.startAlong, widthPx, heightPx);
    const after = splitWall(residual, afterId, opening.endAlong, residual.lengthPx, widthPx, heightPx);
    const preferredHost = opening.startAlong <= residual.lengthPx - opening.endAlong ? before : after;
    replacements.set(residual.candidate.id, [blockedResidual(residual.candidate), before, after]);
    openingRebinds.set(opening.candidate.id, preferredHost.id);
    existingIds.add(beforeId);
    existingIds.add(afterId);
    diagnostics.push({
      code: "door-host-residual-reconsolidated",
      severity: "info",
      message: "Избыточный door-host residual разделён вокруг уже валидированного дверного проёма; дверь привязана к ближайшему структурному фрагменту.",
      candidateId: residual.candidate.id,
    });
  }

  if (replacements.size === 0) {
    return {
      walls: [...input.wallCandidates],
      openings: [...input.openings],
      reconsolidatedCount: 0,
      diagnostics: [],
    };
  }

  const walls = input.wallCandidates.flatMap((candidate) => replacements.get(candidate.id) ?? [candidate]);
  const openings = input.openings.map((candidate) => {
    const host = openingRebinds.get(candidate.id);
    return host ? reboundOpening(candidate, host) : candidate;
  });
  return {
    walls,
    openings,
    reconsolidatedCount: replacements.size,
    diagnostics: diagnostics.sort((first, second) =>
      (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
