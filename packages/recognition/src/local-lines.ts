import type { RecognitionConfidence, RecognitionWallCandidate } from "./model";

export const LOCAL_RECOGNITION_ENGINE_VERSION = "3" as const;

export type DetectedLineSegment = Readonly<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}>;

export type LocalRecognitionOptions = Readonly<{
  minimumSegmentLengthPx: number;
  maximumAngleDeltaDeg: number;
  minimumWallThicknessPx: number;
  maximumWallThicknessPx: number;
  minimumParallelOverlapRatio: number;
  collinearMergeGapPx: number;
  collinearOffsetTolerancePx: number;
}>;

export const DEFAULT_LOCAL_RECOGNITION_OPTIONS: LocalRecognitionOptions = Object.freeze({
  minimumSegmentLengthPx: 40,
  maximumAngleDeltaDeg: 4,
  minimumWallThicknessPx: 6,
  maximumWallThicknessPx: 80,
  minimumParallelOverlapRatio: 0.45,
  collinearMergeGapPx: 32,
  collinearOffsetTolerancePx: 4,
});

export type AdaptiveLocalRecognitionScaleInput = Readonly<{
  analysisMillimetersPerPixel: number;
  widthPx: number;
  heightPx: number;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createAdaptiveLocalRecognitionOptions(
  input: AdaptiveLocalRecognitionScaleInput,
): LocalRecognitionOptions {
  const millimetersPerPixel = finitePositive(input.analysisMillimetersPerPixel, "Масштаб изображения");
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const shortSide = Math.min(widthPx, heightPx);
  const minimumThickness = clamp(45 / millimetersPerPixel, 3, Math.max(4, shortSide * 0.04));
  const maximumThickness = Math.max(
    minimumThickness + 2,
    clamp(650 / millimetersPerPixel, 80, Math.max(90, shortSide * 0.18)),
  );

  return {
    minimumSegmentLengthPx: clamp(160 / millimetersPerPixel, 18, 70),
    maximumAngleDeltaDeg: 7,
    minimumWallThicknessPx: minimumThickness,
    maximumWallThicknessPx: maximumThickness,
    minimumParallelOverlapRatio: 0.22,
    collinearMergeGapPx: clamp(300 / millimetersPerPixel, 24, 120),
    collinearOffsetTolerancePx: clamp(70 / millimetersPerPixel, 4, 18),
  };
}

export type BuildWallCandidatesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  segments: readonly DetectedLineSegment[];
  options?: Partial<LocalRecognitionOptions>;
}>;

type Vector = Readonly<{ x: number; y: number }>;
type CanonicalSegment = Readonly<{
  start: Vector;
  end: Vector;
  direction: Vector;
  normal: Vector;
  length: number;
  angleDeg: number;
}>;
type Centerline = Readonly<{
  start: Vector;
  end: Vector;
  thicknessPx: number;
  evidenceCount: number;
}>;

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} должен быть положительным конечным числом.`);
  return value;
}

function lengthBetween(a: Vector, b: Vector): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function canonicalSegment(segment: DetectedLineSegment): CanonicalSegment | null {
  if (![segment.x1, segment.y1, segment.x2, segment.y2].every(Number.isFinite)) return null;
  let start = { x: segment.x1, y: segment.y1 };
  let end = { x: segment.x2, y: segment.y2 };
  const length = lengthBetween(start, end);
  if (length === 0) return null;
  let direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  if (direction.x < 0 || (Math.abs(direction.x) < 1e-9 && direction.y < 0)) {
    [start, end] = [end, start];
    direction = { x: -direction.x, y: -direction.y };
  }
  const angleDeg = ((Math.atan2(direction.y, direction.x) * 180 / Math.PI) + 180) % 180;
  return { start, end, direction, normal: { x: -direction.y, y: direction.x }, length, angleDeg };
}

function angleDifference(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function dot(point: Vector, axis: Vector): number {
  return point.x * axis.x + point.y * axis.y;
}

function add(a: Vector, b: Vector): Vector {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(point: Vector, amount: number): Vector {
  return { x: point.x * amount, y: point.y * amount };
}

function pointOnAxis(origin: Vector, direction: Vector, normal: Vector, along: number, across: number): Vector {
  return add(origin, add(scale(direction, along), scale(normal, across)));
}

function overlap(first: CanonicalSegment, second: CanonicalSegment): Readonly<{ start: number; end: number; length: number }> | null {
  const axis = first.direction;
  const firstStart = dot(first.start, axis);
  const firstEnd = dot(first.end, axis);
  const secondStart = dot(second.start, axis);
  const secondEnd = dot(second.end, axis);
  const start = Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd));
  const end = Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd));
  return end > start ? { start, end, length: end - start } : null;
}

function pairCenterline(first: CanonicalSegment, second: CanonicalSegment, options: LocalRecognitionOptions): Centerline | null {
  if (angleDifference(first.angleDeg, second.angleDeg) > options.maximumAngleDeltaDeg) return null;
  const overlapRange = overlap(first, second);
  if (!overlapRange) return null;
  const shorter = Math.min(first.length, second.length);
  if (overlapRange.length / shorter < options.minimumParallelOverlapRatio) return null;

  const normal = first.normal;
  const firstOffset = dot(first.start, normal);
  const secondOffset = dot(second.start, normal);
  const thicknessPx = Math.abs(firstOffset - secondOffset);
  if (thicknessPx < options.minimumWallThicknessPx || thicknessPx > options.maximumWallThicknessPx) return null;

  const centerOffset = (firstOffset + secondOffset) / 2;
  return {
    start: pointOnAxis({ x: 0, y: 0 }, first.direction, normal, overlapRange.start, centerOffset),
    end: pointOnAxis({ x: 0, y: 0 }, first.direction, normal, overlapRange.end, centerOffset),
    thicknessPx,
    evidenceCount: 1,
  };
}

function collinear(centerlines: readonly Centerline[], options: LocalRecognitionOptions): Centerline[] {
  const merged: Centerline[] = [];
  for (const candidate of centerlines) {
    let mergedIndex = -1;
    for (let index = 0; index < merged.length; index += 1) {
      const existing = merged[index]!;
      const existingDirection = { x: existing.end.x - existing.start.x, y: existing.end.y - existing.start.y };
      const existingLength = lengthBetween(existing.start, existing.end);
      const candidateDirection = { x: candidate.end.x - candidate.start.x, y: candidate.end.y - candidate.start.y };
      const candidateLength = lengthBetween(candidate.start, candidate.end);
      const first: CanonicalSegment = {
        start: existing.start,
        end: existing.end,
        direction: { x: existingDirection.x / existingLength, y: existingDirection.y / existingLength },
        normal: { x: -existingDirection.y / existingLength, y: existingDirection.x / existingLength },
        length: existingLength,
        angleDeg: ((Math.atan2(existingDirection.y, existingDirection.x) * 180 / Math.PI) + 180) % 180,
      };
      const second: CanonicalSegment = {
        start: candidate.start,
        end: candidate.end,
        direction: { x: candidateDirection.x / candidateLength, y: candidateDirection.y / candidateLength },
        normal: { x: -candidateDirection.y / candidateLength, y: candidateDirection.x / candidateLength },
        length: candidateLength,
        angleDeg: ((Math.atan2(candidateDirection.y, candidateDirection.x) * 180 / Math.PI) + 180) % 180,
      };
      if (angleDifference(first.angleDeg, second.angleDeg) > options.maximumAngleDeltaDeg) continue;
      const normalOffset = Math.abs(dot(first.start, first.normal) - dot(second.start, first.normal));
      if (normalOffset > options.collinearOffsetTolerancePx) continue;
      const axis = first.direction;
      const existingMin = Math.min(dot(first.start, axis), dot(first.end, axis));
      const existingMax = Math.max(dot(first.start, axis), dot(first.end, axis));
      const candidateMin = Math.min(dot(second.start, axis), dot(second.end, axis));
      const candidateMax = Math.max(dot(second.start, axis), dot(second.end, axis));
      const gap = Math.max(0, Math.max(existingMin, candidateMin) - Math.min(existingMax, candidateMax));
      if (gap > options.collinearMergeGapPx) continue;
      mergedIndex = index;
      const start = Math.min(existingMin, candidateMin);
      const end = Math.max(existingMax, candidateMax);
      const across = (dot(first.start, first.normal) + dot(second.start, first.normal)) / 2;
      merged[index] = {
        start: pointOnAxis({ x: 0, y: 0 }, axis, first.normal, start, across),
        end: pointOnAxis({ x: 0, y: 0 }, axis, first.normal, end, across),
        thicknessPx: (existing.thicknessPx * existing.evidenceCount + candidate.thicknessPx * candidate.evidenceCount) / (existing.evidenceCount + candidate.evidenceCount),
        evidenceCount: existing.evidenceCount + candidate.evidenceCount,
      };
      break;
    }
    if (mergedIndex < 0) merged.push(candidate);
  }
  return merged;
}

function confidenceForEvidence(evidenceCount: number): RecognitionConfidence {
  if (evidenceCount >= 3) return "high";
  if (evidenceCount === 2) return "medium";
  return "low";
}

export function buildWallCandidates(input: BuildWallCandidatesInput): RecognitionWallCandidate[] {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const options = { ...DEFAULT_LOCAL_RECOGNITION_OPTIONS, ...input.options };
  const segments = input.segments
    .map(canonicalSegment)
    .filter((segment): segment is CanonicalSegment => segment !== null && segment.length >= options.minimumSegmentLengthPx);
  const centerlines: Centerline[] = [];
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const candidate = pairCenterline(segments[firstIndex]!, segments[secondIndex]!, options);
      if (candidate) centerlines.push(candidate);
    }
  }
  return collinear(centerlines, options).map((wall, index) => ({
    id: `local-wall-${index + 1}`,
    start: { x: clamp(wall.start.x / widthPx, 0, 1), y: clamp(wall.start.y / heightPx, 0, 1) },
    end: { x: clamp(wall.end.x / widthPx, 0, 1), y: clamp(wall.end.y / heightPx, 0, 1) },
    estimatedThicknessPx: wall.thicknessPx,
    confidence: confidenceForEvidence(wall.evidenceCount),
    evidence: {
      localScore: Math.min(1, 0.55 + wall.evidenceCount * 0.12),
      cloudScore: null,
      reasons: ["paired-parallel-edges", `evidence:${wall.evidenceCount}`],
    },
    origin: "local",
    conflict: null,
  }));
}
