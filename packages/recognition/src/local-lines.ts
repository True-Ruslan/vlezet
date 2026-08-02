import {
  normaliseArchitecturalLineSegments,
  type NormalisedLineSegment,
} from "./architectural-lines";
import type { RecognitionConfidence, RecognitionWallCandidate } from "./model";
import {
  buildLocalWallTopology,
  topologyWallCandidates,
  type LocalWallCenterline,
  type LocalWallPoint,
  type LocalWallTopology,
} from "./wall-topology";

export const LOCAL_RECOGNITION_ENGINE_VERSION = "4" as const;

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
  axisToleranceDeg: number;
  duplicateEndpointTolerancePx: number;
  borderMarginPx: number;
  borderSpanRatio: number;
  endpointSnapTolerancePx: number;
  endpointExtensionTolerancePx: number;
  intersectionTolerancePx: number;
  minimumTopologyEdgeLengthPx: number;
}>;

export const DEFAULT_LOCAL_RECOGNITION_OPTIONS: LocalRecognitionOptions = Object.freeze({
  minimumSegmentLengthPx: 40,
  maximumAngleDeltaDeg: 4,
  minimumWallThicknessPx: 6,
  maximumWallThicknessPx: 80,
  minimumParallelOverlapRatio: 0.45,
  collinearMergeGapPx: 32,
  collinearOffsetTolerancePx: 4,
  axisToleranceDeg: 8,
  duplicateEndpointTolerancePx: 2,
  borderMarginPx: 4,
  borderSpanRatio: 0.95,
  endpointSnapTolerancePx: 8,
  endpointExtensionTolerancePx: 18,
  intersectionTolerancePx: 3,
  minimumTopologyEdgeLengthPx: 12,
});

export type AdaptiveLocalRecognitionScaleInput = Readonly<{
  analysisMillimetersPerPixel: number;
  widthPx: number;
  heightPx: number;
}>;

type Vector = LocalWallPoint;
type CanonicalSegment = Readonly<{
  start: Vector;
  end: Vector;
  direction: Vector;
  normal: Vector;
  length: number;
  angleDeg: number;
  sourceCount: number;
}>;

export type BuildWallCandidatesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  segments: readonly DetectedLineSegment[];
  options?: Partial<LocalRecognitionOptions>;
}>;

export type LocalWallCandidateAnalysis = Readonly<{
  inputSegmentCount: number;
  normalisedSegmentCount: number;
  pairedCenterlineCount: number;
  topology: LocalWallTopology;
  candidates: readonly RecognitionWallCandidate[];
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} должен быть положительным конечным числом.`);
  return value;
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
    axisToleranceDeg: 10,
    duplicateEndpointTolerancePx: clamp(20 / millimetersPerPixel, 1.5, 5),
    borderMarginPx: clamp(30 / millimetersPerPixel, 3, 12),
    borderSpanRatio: 0.95,
    endpointSnapTolerancePx: clamp(100 / millimetersPerPixel, 6, 24),
    endpointExtensionTolerancePx: clamp(180 / millimetersPerPixel, 10, 42),
    intersectionTolerancePx: clamp(45 / millimetersPerPixel, 2, 12),
    minimumTopologyEdgeLengthPx: clamp(120 / millimetersPerPixel, 10, 40),
  };
}

function lengthBetween(a: Vector, b: Vector): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function canonicalSegment(segment: NormalisedLineSegment): CanonicalSegment | null {
  const length = lengthBetween(segment.start, segment.end);
  if (length === 0) return null;
  const direction = {
    x: (segment.end.x - segment.start.x) / length,
    y: (segment.end.y - segment.start.y) / length,
  };
  return {
    start: segment.start,
    end: segment.end,
    direction,
    normal: { x: -direction.y, y: direction.x },
    length,
    angleDeg: segment.angleDeg,
    sourceCount: segment.sourceCount,
  };
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

function confidenceForEvidence(evidenceCount: number): RecognitionConfidence {
  if (evidenceCount >= 3) return "high";
  if (evidenceCount === 2) return "medium";
  return "low";
}

function pairCenterline(
  first: CanonicalSegment,
  second: CanonicalSegment,
  options: LocalRecognitionOptions,
): LocalWallCenterline | null {
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
  const evidenceCount = Math.max(1, Math.min(first.sourceCount, second.sourceCount));
  return {
    startPx: pointOnAxis({ x: 0, y: 0 }, first.direction, normal, overlapRange.start, centerOffset),
    endPx: pointOnAxis({ x: 0, y: 0 }, first.direction, normal, overlapRange.end, centerOffset),
    thicknessPx,
    evidenceCount,
    confidence: confidenceForEvidence(evidenceCount),
    reasons: ["paired-parallel-edges", `evidence:${evidenceCount}`],
  };
}

export function analyzeWallCandidates(input: BuildWallCandidatesInput): LocalWallCandidateAnalysis {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const options = { ...DEFAULT_LOCAL_RECOGNITION_OPTIONS, ...input.options };
  const normalised = normaliseArchitecturalLineSegments({
    widthPx,
    heightPx,
    segments: input.segments,
    options: {
      minimumSegmentLengthPx: options.minimumSegmentLengthPx,
      axisToleranceDeg: options.axisToleranceDeg,
      duplicateEndpointTolerancePx: options.duplicateEndpointTolerancePx,
      borderMarginPx: options.borderMarginPx,
      borderSpanRatio: options.borderSpanRatio,
    },
  });
  const segments = normalised
    .map(canonicalSegment)
    .filter((segment): segment is CanonicalSegment => segment !== null);
  const centerlines: LocalWallCenterline[] = [];
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const candidate = pairCenterline(segments[firstIndex]!, segments[secondIndex]!, options);
      if (candidate) centerlines.push(candidate);
    }
  }

  const topology = buildLocalWallTopology({
    centerlines,
    endpointSnapTolerancePx: options.endpointSnapTolerancePx,
    endpointExtensionTolerancePx: options.endpointExtensionTolerancePx,
    intersectionTolerancePx: options.intersectionTolerancePx,
    minimumEdgeLengthPx: options.minimumTopologyEdgeLengthPx,
  });
  return {
    inputSegmentCount: input.segments.length,
    normalisedSegmentCount: normalised.length,
    pairedCenterlineCount: centerlines.length,
    topology,
    candidates: topologyWallCandidates({ topology, widthPx, heightPx }),
  };
}

export function buildWallCandidates(input: BuildWallCandidatesInput): RecognitionWallCandidate[] {
  return [...analyzeWallCandidates(input).candidates];
}
