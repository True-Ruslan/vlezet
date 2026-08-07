import type { DetectedLineSegment } from "./local-lines";
import { analyzeWallCandidates } from "./local-lines";
import type { RecognitionDiagnostic, RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type StrongMaskRotatedWallRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredWalls: readonly RecognitionWallCandidate[];
  recoveredCount: number;
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
const MAX_SEGMENTS = 512;
const MIN_ROTATED_AXIS_DELTA_DEG = 20;
const MAX_DUPLICATE_ANGLE_DELTA_DEG = 8;
const MIN_LENGTH_SHORT_SIDE_RATIO = 0.35;
const MIN_EVIDENCE_COUNT = 2;
const MIN_MASK_OCCUPANCY = 0.95;
const MIN_MASK_CONTINUITY = 0.95;
const MAX_ALONG_SAMPLES = 224;
const ACROSS_SAMPLES = 7;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

function axisDelta(angle: number): number {
  return Math.min(angle, Math.abs(90 - angle), Math.abs(180 - angle));
}

function pixelPoint(
  point: RecognitionWallCandidate["start"],
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
  const start = pixelPoint(candidate.start, widthPx, heightPx);
  const end = pixelPoint(candidate.end, widthPx, heightPx);
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
  return {
    candidate,
    start,
    end,
    tangent: { x: vector.x / lengthPx, y: vector.y / lengthPx },
    normal: { x: -vector.y / lengthPx, y: vector.x / lengthPx },
    lengthPx,
    thicknessPx,
    angleDeg: angleDeg(start, end),
  };
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const vector = subtract(end, start);
  const lengthSquared = dot(vector, vector);
  if (lengthSquared <= EPSILON) return distance(point, start);
  const ratio = clamp(dot(subtract(point, start), vector) / lengthSquared, 0, 1);
  return distance(point, add(start, scale(vector, ratio)));
}

function evidenceCount(candidate: RecognitionWallCandidate): number {
  let maximum = 0;
  for (const reason of candidate.evidence.reasons) {
    const match = /^evidence:(\d+)$/.exec(reason);
    if (!match) continue;
    maximum = Math.max(maximum, Number.parseInt(match[1] ?? "0", 10));
  }
  return maximum;
}

function maskSupport(wall: PixelWall, mask: StructuralMaskView): Readonly<{
  occupancy: number;
  continuity: number;
}> {
  const alongSamples = Math.max(24, Math.min(MAX_ALONG_SAMPLES, Math.ceil(wall.lengthPx / 4)));
  const halfThickness = Math.max(3, wall.thicknessPx / 2);
  let structuralSamples = 0;
  let totalSamples = 0;
  let currentRun = 0;
  let longestRun = 0;

  for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
    const alongRatio = (alongIndex + 0.5) / alongSamples;
    const center = add(wall.start, scale(subtract(wall.end, wall.start), alongRatio));
    let structuralAcross = 0;
    for (let acrossIndex = 0; acrossIndex < ACROSS_SAMPLES; acrossIndex += 1) {
      const acrossRatio = (acrossIndex + 0.5) / ACROSS_SAMPLES;
      const offset = -halfThickness + 2 * halfThickness * acrossRatio;
      const point = add(center, scale(wall.normal, offset));
      totalSamples += 1;
      if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) {
        structuralSamples += 1;
        structuralAcross += 1;
      }
    }
    if (structuralAcross / ACROSS_SAMPLES >= 0.5) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return {
    occupancy: structuralSamples / Math.max(1, totalSamples),
    continuity: longestRun / alongSamples,
  };
}

function anchoredToPrimary(
  wall: PixelWall,
  primaryWalls: readonly PixelWall[],
): boolean {
  const tolerancePx = Math.max(18, wall.thicknessPx * 1.5);
  return primaryWalls.some((primary) =>
    primary.candidate.conflict === null
    && (
      pointToSegmentDistance(wall.start, primary.start, primary.end) <= tolerancePx
      || pointToSegmentDistance(wall.end, primary.start, primary.end) <= tolerancePx
    ));
}

function overlapRatio(first: PixelWall, second: PixelWall): number {
  const secondStart = dot(subtract(second.start, first.start), first.tangent);
  const secondEnd = dot(subtract(second.end, first.start), first.tangent);
  const overlap = Math.max(
    0,
    Math.min(first.lengthPx, Math.max(secondStart, secondEnd))
      - Math.max(0, Math.min(secondStart, secondEnd)),
  );
  return overlap / Math.max(EPSILON, Math.min(first.lengthPx, second.lengthPx));
}

function isPhysicalDuplicate(
  wall: PixelWall,
  primaryWalls: readonly PixelWall[],
): boolean {
  return primaryWalls.some((primary) => {
    if (primary.candidate.conflict !== null) return false;
    if (angleDelta(wall.angleDeg, primary.angleDeg) > MAX_DUPLICATE_ANGLE_DELTA_DEG) return false;
    const midpoint = scale(add(wall.start, wall.end), 0.5);
    const offsetTolerancePx = Math.max(12, Math.min(wall.thicknessPx, primary.thicknessPx) * 0.6);
    if (pointToSegmentDistance(midpoint, primary.start, primary.end) > offsetTolerancePx) return false;
    return overlapRatio(wall, primary) >= 0.65;
  });
}

function recoveredCandidate(candidate: RecognitionWallCandidate): RecognitionWallCandidate {
  return {
    ...candidate,
    id: `strong-mask-rotated-${candidate.id}`,
    confidence: "medium",
    conflict: null,
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.74, 0.78),
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "strong-mask-rotated-wall-chain",
      ])].sort(),
    },
  };
}

export function selectStrongMaskRotatedWallRecoveries(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  replayWalls: readonly RecognitionWallCandidate[];
  mask: StructuralMaskView;
}>): StrongMaskRotatedWallRecoveryResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) {
    return {
      walls: [...input.primaryWalls],
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: [{
        code: "strong-mask-rotated-recovery-invalid-mask",
        severity: "warning",
        message: "Восстановление диагональных structural chains пропущено из-за несовпадающего structural mask.",
        candidateId: null,
      }],
    };
  }
  if (
    input.primaryWalls.length > MAX_WALL_CANDIDATES
    || input.replayWalls.length > MAX_WALL_CANDIDATES
  ) {
    return {
      walls: [...input.primaryWalls],
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: [{
        code: "strong-mask-rotated-recovery-budget-exceeded",
        severity: "warning",
        message: "Восстановление диагональных structural chains пропущено из-за безопасного лимита кандидатов.",
        candidateId: null,
      }],
    };
  }

  const shortSide = Math.min(input.widthPx, input.heightPx);
  const minimumLengthPx = shortSide * MIN_LENGTH_SHORT_SIDE_RATIO;
  const primaryPixelWalls = input.primaryWalls
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const recovered: RecognitionWallCandidate[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];

  for (const candidate of [...input.replayWalls].sort((first, second) => first.id.localeCompare(second.id))) {
    if (candidate.conflict !== null) continue;
    if (!candidate.evidence.reasons.includes("paired-parallel-edges")) continue;
    if (!candidate.evidence.reasons.includes("collinear-centerline-merge")) continue;
    if (evidenceCount(candidate) < MIN_EVIDENCE_COUNT) continue;
    const wall = pixelWall(candidate, input.widthPx, input.heightPx);
    if (!wall) continue;
    if (wall.lengthPx < minimumLengthPx) continue;
    if (axisDelta(wall.angleDeg) < MIN_ROTATED_AXIS_DELTA_DEG) continue;
    if (isPhysicalDuplicate(wall, primaryPixelWalls)) continue;
    if (!anchoredToPrimary(wall, primaryPixelWalls)) continue;
    const support = maskSupport(wall, input.mask);
    if (support.occupancy < MIN_MASK_OCCUPANCY || support.continuity < MIN_MASK_CONTINUITY) continue;

    const accepted = recoveredCandidate(candidate);
    recovered.push(accepted);
    diagnostics.push({
      code: "strong-mask-rotated-wall-chain",
      severity: "info",
      message: "Диагональная стеновая цепочка восстановлена только после подтверждения парных линий, непрерывного structural mask и связи с принятой сетью стен.",
      candidateId: accepted.id,
    });
  }

  const byId = new Map<string, RecognitionWallCandidate>();
  for (const candidate of [...input.primaryWalls, ...recovered]) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }
  return {
    walls: [...byId.values()].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls: [...recovered].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredCount: recovered.length,
    diagnostics: diagnostics.sort((first, second) =>
      (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}

export function recoverStrongMaskRotatedWalls(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  segments: readonly DetectedLineSegment[];
  mask: StructuralMaskView;
}>): StrongMaskRotatedWallRecoveryResult {
  if (input.segments.length > MAX_SEGMENTS || input.primaryWalls.length < 1) {
    return {
      walls: [...input.primaryWalls],
      recoveredWalls: [],
      recoveredCount: 0,
      diagnostics: input.segments.length > MAX_SEGMENTS
        ? [{
            code: "strong-mask-rotated-recovery-segment-budget-exceeded",
            severity: "warning",
            message: "Восстановление диагональных structural chains пропущено из-за безопасного лимита линейных признаков.",
            candidateId: null,
          }]
        : [],
    };
  }

  const shortSide = Math.min(input.widthPx, input.heightPx);
  const replay = analyzeWallCandidates({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    segments: input.segments,
    options: {
      collinearMergeGapPx: clamp(shortSide * 0.12, 120, 180),
      endpointExtensionTolerancePx: clamp(shortSide * 0.045, 32, 64),
    },
  });
  return selectStrongMaskRotatedWallRecoveries({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    primaryWalls: input.primaryWalls,
    replayWalls: replay.candidates,
    mask: input.mask,
  });
}
