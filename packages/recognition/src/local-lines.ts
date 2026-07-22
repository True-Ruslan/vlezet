import type { RecognitionConfidence, RecognitionWallCandidate } from "./model";

export const LOCAL_RECOGNITION_ENGINE_VERSION = "2" as const;

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

function midpoint(segment: CanonicalSegment): Vector {
  return { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
}

function projectionRange(segment: CanonicalSegment, axis: Vector): readonly [number, number] {
  const first = dot(segment.start, axis);
  const second = dot(segment.end, axis);
  return first <= second ? [first, second] : [second, first];
}

function overlapLength(first: readonly [number, number], second: readonly [number, number]): number {
  return Math.max(0, Math.min(first[1], second[1]) - Math.max(first[0], second[0]));
}

function pointFromAxes(along: number, across: number, direction: Vector, normal: Vector): Vector {
  return {
    x: along * direction.x + across * normal.x,
    y: along * direction.y + across * normal.y,
  };
}

function pairEdges(
  first: CanonicalSegment,
  second: CanonicalSegment,
  options: LocalRecognitionOptions,
): Centerline | null {
  if (angleDifference(first.angleDeg, second.angleDeg) > options.maximumAngleDeltaDeg) return null;
  const direction = first.direction;
  const normal = first.normal;
  const firstRange = projectionRange(first, direction);
  const secondRange = projectionRange(second, direction);
  const overlap = overlapLength(firstRange, secondRange);
  const shorter = Math.min(first.length, second.length);
  if (shorter === 0 || overlap / shorter < options.minimumParallelOverlapRatio) return null;

  const firstAcross = dot(midpoint(first), normal);
  const secondAcross = dot(midpoint(second), normal);
  const thicknessPx = Math.abs(secondAcross - firstAcross);
  if (thicknessPx < options.minimumWallThicknessPx || thicknessPx > options.maximumWallThicknessPx) return null;

  const alongStart = Math.min(firstRange[0], secondRange[0]);
  const alongEnd = Math.max(firstRange[1], secondRange[1]);
  const across = (firstAcross + secondAcross) / 2;
  return {
    start: pointFromAxes(alongStart, across, direction, normal),
    end: pointFromAxes(alongEnd, across, direction, normal),
    thicknessPx,
    evidenceCount: 2,
  };
}

function centerlineCanonical(line: Centerline): CanonicalSegment {
  return canonicalSegment({ x1: line.start.x, y1: line.start.y, x2: line.end.x, y2: line.end.y })!;
}

function mergeTwo(first: Centerline, second: Centerline, options: LocalRecognitionOptions): Centerline | null {
  const a = centerlineCanonical(first);
  const b = centerlineCanonical(second);
  if (angleDifference(a.angleDeg, b.angleDeg) > options.maximumAngleDeltaDeg) return null;
  const direction = a.direction;
  const normal = a.normal;
  const acrossA = dot(midpoint(a), normal);
  const acrossB = dot(midpoint(b), normal);
  if (Math.abs(acrossA - acrossB) > options.collinearOffsetTolerancePx) return null;
  const rangeA = projectionRange(a, direction);
  const rangeB = projectionRange(b, direction);
  const gap = Math.max(0, Math.max(rangeA[0], rangeB[0]) - Math.min(rangeA[1], rangeB[1]));
  if (gap > options.collinearMergeGapPx) return null;
  const start = Math.min(rangeA[0], rangeB[0]);
  const end = Math.max(rangeA[1], rangeB[1]);
  const totalEvidence = first.evidenceCount + second.evidenceCount;
  const across = (acrossA * first.evidenceCount + acrossB * second.evidenceCount) / totalEvidence;
  return {
    start: pointFromAxes(start, across, direction, normal),
    end: pointFromAxes(end, across, direction, normal),
    thicknessPx: (first.thicknessPx * first.evidenceCount + second.thicknessPx * second.evidenceCount) / totalEvidence,
    evidenceCount: totalEvidence,
  };
}

function mergeCenterlines(lines: readonly Centerline[], options: LocalRecognitionOptions): Centerline[] {
  const result: Centerline[] = [];
  for (const line of lines) {
    let current = line;
    let merged = true;
    while (merged) {
      merged = false;
      for (let index = 0; index < result.length; index += 1) {
        const combined = mergeTwo(result[index]!, current, options);
        if (!combined) continue;
        result.splice(index, 1);
        current = combined;
        merged = true;
        break;
      }
    }
    result.push(current);
  }
  return result;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function confidenceFor(line: Centerline): RecognitionConfidence {
  return line.evidenceCount >= 4 ? "high" : "medium";
}

export function buildWallCandidates(input: BuildWallCandidatesInput): RecognitionWallCandidate[] {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const options = { ...DEFAULT_LOCAL_RECOGNITION_OPTIONS, ...input.options };
  const segments = input.segments
    .map(canonicalSegment)
    .filter((segment): segment is CanonicalSegment => segment !== null && segment.length >= options.minimumSegmentLengthPx);

  const paired: Centerline[] = [];
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      const candidate = pairEdges(segments[first]!, segments[second]!, options);
      if (candidate) paired.push(candidate);
    }
  }

  return mergeCenterlines(paired, options)
    .sort((a, b) => a.start.y - b.start.y || a.start.x - b.start.x || a.end.x - b.end.x)
    .map((line, index) => ({
      id: `local-wall-${index + 1}`,
      start: { x: clamp01(line.start.x / widthPx), y: clamp01(line.start.y / heightPx) },
      end: { x: clamp01(line.end.x / widthPx), y: clamp01(line.end.y / heightPx) },
      estimatedThicknessPx: line.thicknessPx,
      confidence: confidenceFor(line),
      evidence: {
        localScore: line.evidenceCount >= 4 ? 0.92 : 0.78,
        cloudScore: null,
        reasons: line.evidenceCount >= 4 ? ["parallel-edges", "collinear-support"] : ["parallel-edges"],
      },
      origin: "local" as const,
      conflict: null,
    }));
}
