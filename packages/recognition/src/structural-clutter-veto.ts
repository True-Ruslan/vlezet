import type { DetectedLineSegment } from "./local-lines";
import type {
  RecognitionDiagnostic,
  RecognitionWallCandidate,
} from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type StructuralClutterVetoResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  blockedCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  lengthPx: number;
  halfThicknessPx: number;
}>;

const MAX_WALL_CANDIDATES = 96;
const MAX_SYMBOL_SEGMENTS = 512;
const SHORT_WALL_RATIO = 0.22;
const MIN_STRUCTURAL_SUPPORT_RATIO = 0.62;
const MIN_NEARBY_SYMBOL_COUNT = 2;
const MAX_ALONG_SAMPLES = 48;
const MAX_ACROSS_SAMPLES = 13;
const ENDPOINT_ANCHOR_TOLERANCE_PX = 14;

function pixelPoint(
  candidate: RecognitionWallCandidate,
  endpoint: "start" | "end",
  widthPx: number,
  heightPx: number,
): Point {
  const point = candidate[endpoint];
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function pixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  const start = pixelPoint(candidate, "start", widthPx, heightPx);
  const end = pixelPoint(candidate, "end", widthPx, heightPx);
  const lengthPx = distance(start, end);
  if (!Number.isFinite(lengthPx) || lengthPx <= 0) return null;
  return {
    candidate,
    start,
    end,
    lengthPx,
    halfThicknessPx: Math.max(3, (candidate.estimatedThicknessPx ?? 20) / 2),
  };
}

function structuralSupportRatio(wall: PixelWall, mask: StructuralMaskView): number {
  const tangent = {
    x: (wall.end.x - wall.start.x) / wall.lengthPx,
    y: (wall.end.y - wall.start.y) / wall.lengthPx,
  };
  const normal = { x: -tangent.y, y: tangent.x };
  const alongSamples = Math.max(5, Math.min(MAX_ALONG_SAMPLES, Math.ceil(wall.lengthPx / 3)));
  const acrossSamples = Math.max(5, Math.min(MAX_ACROSS_SAMPLES, Math.ceil(wall.halfThicknessPx)));
  let structural = 0;
  let total = 0;

  for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
    const along = wall.lengthPx * (alongIndex + 0.5) / alongSamples;
    for (let acrossIndex = 0; acrossIndex < acrossSamples; acrossIndex += 1) {
      const across = -wall.halfThicknessPx
        + wall.halfThicknessPx * 2 * (acrossIndex + 0.5) / acrossSamples;
      const x = wall.start.x + tangent.x * along + normal.x * across;
      const y = wall.start.y + tangent.y * along + normal.y * across;
      total += 1;
      if (mask.isStructural(Math.floor(x), Math.floor(y))) structural += 1;
    }
  }
  return structural / Math.max(1, total);
}

function endpointAnchorCount(wall: PixelWall, network: readonly PixelWall[]): number {
  let count = 0;
  for (const endpoint of [wall.start, wall.end]) {
    const anchored = network.some((candidate) =>
      candidate.candidate.id !== wall.candidate.id
      && candidate.candidate.conflict === null
      && pointToSegmentDistance(endpoint, candidate.start, candidate.end)
        <= Math.max(ENDPOINT_ANCHOR_TOLERANCE_PX, Math.min(wall.halfThicknessPx, candidate.halfThicknessPx)));
    if (anchored) count += 1;
  }
  return count;
}

function nearbySymbolCount(
  wall: PixelWall,
  segments: readonly DetectedLineSegment[],
): number {
  const tolerance = Math.max(12, wall.halfThicknessPx + 6);
  return segments.reduce((count, segment) => {
    const midpoint = {
      x: (segment.x1 + segment.x2) / 2,
      y: (segment.y1 + segment.y2) / 2,
    };
    return count + (pointToSegmentDistance(midpoint, wall.start, wall.end) <= tolerance ? 1 : 0);
  }, 0);
}

function preserveResult(
  candidates: readonly RecognitionWallCandidate[],
  diagnostic: RecognitionDiagnostic | null,
): StructuralClutterVetoResult {
  return {
    walls: [...candidates].sort((first, second) => first.id.localeCompare(second.id)),
    blockedCount: 0,
    diagnostics: diagnostic ? [diagnostic] : [],
  };
}

export function applyStructuralClutterVeto(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): StructuralClutterVetoResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) {
    return preserveResult(input.wallCandidates, {
      code: "structural-clutter-veto-invalid-mask",
      severity: "warning",
      message: "Проверка структурного шума пропущена из-за несовпадающих размеров растра.",
      candidateId: null,
    });
  }
  if (
    input.wallCandidates.length > MAX_WALL_CANDIDATES
    || input.symbolSegments.length > MAX_SYMBOL_SEGMENTS
  ) {
    return preserveResult(input.wallCandidates, {
      code: "structural-clutter-veto-budget-exceeded",
      severity: "warning",
      message: "Проверка структурного шума пропущена из-за безопасного лимита кандидатов.",
      candidateId: null,
    });
  }

  const candidates = [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id));
  const segments = [...input.symbolSegments].sort((first, second) =>
    first.x1 - second.x1
    || first.y1 - second.y1
    || first.x2 - second.x2
    || first.y2 - second.y2);
  const walls = candidates
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const shortWallLimitPx = Math.min(input.widthPx, input.heightPx) * SHORT_WALL_RATIO;
  const diagnostics: RecognitionDiagnostic[] = [];
  let blockedCount = 0;

  const output = candidates.map((candidate) => {
    if (candidate.conflict !== null) return candidate;
    const wall = walls.find((item) => item.candidate.id === candidate.id);
    if (!wall || wall.lengthPx >= shortWallLimitPx) return candidate;
    const supportRatio = structuralSupportRatio(wall, input.mask);
    if (supportRatio >= MIN_STRUCTURAL_SUPPORT_RATIO) return candidate;
    if (endpointAnchorCount(wall, walls) >= 2) return candidate;
    const symbolCount = nearbySymbolCount(wall, segments);
    if (symbolCount < MIN_NEARBY_SYMBOL_COUNT) return candidate;

    blockedCount += 1;
    diagnostics.push({
      code: "structural-clutter-veto",
      severity: "warning",
      message: "Короткий слабо заполненный контур рядом с условными обозначениями оставлен только для диагностики и не считается стеной.",
      candidateId: candidate.id,
    });
    return {
      ...candidate,
      confidence: "low" as const,
      conflict: "unsupported" as const,
      evidence: {
        ...candidate.evidence,
        localScore: Math.min(candidate.evidence.localScore ?? 0.5, 0.5),
        reasons: [...new Set([
          ...candidate.evidence.reasons,
          "structural-clutter-veto",
        ])].sort(),
      },
    };
  });

  return {
    walls: output.sort((first, second) => first.id.localeCompare(second.id)),
    blockedCount,
    diagnostics: diagnostics.sort((first, second) =>
      (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}
