import {
  normaliseArchitecturalLineSegments,
  type NormalisedLineSegment,
} from "./architectural-lines";
import type { RecognitionConfidence, RecognitionWallCandidate } from "./model";
import { selectDominantWallThicknessCenterlines } from "./wall-evidence-filter";
import {
  buildLocalWallTopology,
  topologyWallCandidates,
  type LocalWallCenterline,
  type LocalWallPoint,
  type LocalWallTopology,
  type LocalWallTopologyEdge,
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
  collinearMergeGapPx: 120,
  collinearOffsetTolerancePx: 4,
  axisToleranceDeg: 8,
  duplicateEndpointTolerancePx: 2,
  borderMarginPx: 4,
  borderSpanRatio: 0.95,
  endpointSnapTolerancePx: 8,
  endpointExtensionTolerancePx: 32,
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
  consolidatedCenterlineCount: number;
  thicknessFilteredCenterlineCount: number;
  topology: LocalWallTopology;
  candidates: readonly RecognitionWallCandidate[];
}>;

const EPSILON = 1e-7;

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
    collinearMergeGapPx: clamp(1400 / millimetersPerPixel, 40, 180),
    collinearOffsetTolerancePx: clamp(70 / millimetersPerPixel, 4, 18),
    axisToleranceDeg: 10,
    duplicateEndpointTolerancePx: clamp(20 / millimetersPerPixel, 1.5, 5),
    borderMarginPx: clamp(30 / millimetersPerPixel, 3, 12),
    borderSpanRatio: 0.95,
    endpointSnapTolerancePx: clamp(100 / millimetersPerPixel, 6, 24),
    endpointExtensionTolerancePx: clamp(450 / millimetersPerPixel, 12, 60),
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

function canonicalCenterline(line: LocalWallCenterline): LocalWallCenterline {
  const forward = line.startPx.x < line.endPx.x
    || (Math.abs(line.startPx.x - line.endPx.x) <= EPSILON && line.startPx.y <= line.endPx.y);
  return forward ? line : { ...line, startPx: line.endPx, endPx: line.startPx };
}

function centerlineDirection(line: LocalWallCenterline): Vector {
  const length = lengthBetween(line.startPx, line.endPx);
  return {
    x: (line.endPx.x - line.startPx.x) / length,
    y: (line.endPx.y - line.startPx.y) / length,
  };
}

function perpendicularDistance(point: Vector, line: LocalWallCenterline): number {
  const direction = centerlineDirection(line);
  const normal = { x: -direction.y, y: direction.x };
  return Math.abs(dot(point, normal) - dot(line.startPx, normal));
}

function mergeCenterlineFragments(
  input: readonly LocalWallCenterline[],
  options: LocalRecognitionOptions,
): LocalWallCenterline[] {
  const pending = input.map(canonicalCenterline).sort((first, second) =>
    first.startPx.x - second.startPx.x
    || first.startPx.y - second.startPx.y
    || first.endPx.x - second.endPx.x
    || first.endPx.y - second.endPx.y);
  const merged: LocalWallCenterline[] = [];

  for (const candidate of pending) {
    let mergedIndex = -1;
    for (let index = 0; index < merged.length; index += 1) {
      const existing = merged[index]!;
      const firstDirection = centerlineDirection(existing);
      const secondDirection = centerlineDirection(candidate);
      const angle = Math.acos(clamp(Math.abs(dot(firstDirection, secondDirection)), -1, 1)) * 180 / Math.PI;
      if (angle > options.maximumAngleDeltaDeg) continue;
      if (perpendicularDistance(candidate.startPx, existing) > options.collinearOffsetTolerancePx) continue;
      if (perpendicularDistance(candidate.endPx, existing) > options.collinearOffsetTolerancePx) continue;

      const existingStart = dot(existing.startPx, firstDirection);
      const existingEnd = dot(existing.endPx, firstDirection);
      const candidateStart = dot(candidate.startPx, firstDirection);
      const candidateEnd = dot(candidate.endPx, firstDirection);
      const firstMinimum = Math.min(existingStart, existingEnd);
      const firstMaximum = Math.max(existingStart, existingEnd);
      const secondMinimum = Math.min(candidateStart, candidateEnd);
      const secondMaximum = Math.max(candidateStart, candidateEnd);
      const gap = Math.max(0, Math.max(firstMinimum, secondMinimum) - Math.min(firstMaximum, secondMaximum));
      if (gap > options.collinearMergeGapPx) continue;

      const normal = { x: -firstDirection.y, y: firstDirection.x };
      const totalEvidence = existing.evidenceCount + candidate.evidenceCount;
      const offset = (
        dot(existing.startPx, normal) * existing.evidenceCount
        + dot(candidate.startPx, normal) * candidate.evidenceCount
      ) / totalEvidence;
      const minimum = Math.min(firstMinimum, secondMinimum);
      const maximum = Math.max(firstMaximum, secondMaximum);
      const pointAt = (along: number): Vector => add(scale(firstDirection, along), scale(normal, offset));
      const startPx = pointAt(minimum);
      const endPx = pointAt(maximum);
      const thicknessPx = existing.thicknessPx === null
        ? candidate.thicknessPx
        : candidate.thicknessPx === null
          ? existing.thicknessPx
          : (
              existing.thicknessPx * existing.evidenceCount
              + candidate.thicknessPx * candidate.evidenceCount
            ) / totalEvidence;
      merged[index] = canonicalCenterline({
        startPx,
        endPx,
        thicknessPx,
        evidenceCount: totalEvidence,
        confidence: confidenceForEvidence(totalEvidence),
        reasons: [...new Set([
          ...existing.reasons,
          ...candidate.reasons,
          "collinear-centerline-merge",
          ...(gap > EPSILON ? ["bounded-opening-gap-bridge"] : []),
        ])].sort(),
      });
      mergedIndex = index;
      break;
    }
    if (mergedIndex < 0) merged.push(candidate);
  }
  return merged.sort((first, second) =>
    first.startPx.x - second.startPx.x
    || first.startPx.y - second.startPx.y
    || first.endPx.x - second.endPx.x
    || first.endPx.y - second.endPx.y);
}

type TopologyComponent = Readonly<{
  edgeIds: ReadonlySet<string>;
  totalLengthPx: number;
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}>;

function topologyComponents(topology: LocalWallTopology): TopologyComponent[] {
  const edgesByJunction = new Map<string, LocalWallTopologyEdge[]>();
  for (const edge of topology.edges) {
    const start = edgesByJunction.get(edge.startJunctionId) ?? [];
    start.push(edge);
    edgesByJunction.set(edge.startJunctionId, start);
    const end = edgesByJunction.get(edge.endJunctionId) ?? [];
    end.push(edge);
    edgesByJunction.set(edge.endJunctionId, end);
  }
  const visitedEdges = new Set<string>();
  const components: TopologyComponent[] = [];
  for (const seed of [...topology.edges].sort((first, second) => first.id.localeCompare(second.id))) {
    if (visitedEdges.has(seed.id)) continue;
    const stack = [seed];
    const edgeIds = new Set<string>();
    let totalLengthPx = 0;
    let minimumX = Number.POSITIVE_INFINITY;
    let maximumX = Number.NEGATIVE_INFINITY;
    let minimumY = Number.POSITIVE_INFINITY;
    let maximumY = Number.NEGATIVE_INFINITY;
    while (stack.length > 0) {
      const edge = stack.pop()!;
      if (visitedEdges.has(edge.id)) continue;
      visitedEdges.add(edge.id);
      edgeIds.add(edge.id);
      totalLengthPx += lengthBetween(edge.startPx, edge.endPx);
      for (const point of [edge.startPx, edge.endPx]) {
        minimumX = Math.min(minimumX, point.x);
        maximumX = Math.max(maximumX, point.x);
        minimumY = Math.min(minimumY, point.y);
        maximumY = Math.max(maximumY, point.y);
      }
      for (const junctionId of [edge.startJunctionId, edge.endJunctionId]) {
        for (const neighbour of edgesByJunction.get(junctionId) ?? []) {
          if (!visitedEdges.has(neighbour.id)) stack.push(neighbour);
        }
      }
    }
    components.push({ edgeIds, totalLengthPx, minimumX, maximumX, minimumY, maximumY });
  }
  return components.sort((first, second) =>
    second.totalLengthPx - first.totalLengthPx
    || second.edgeIds.size - first.edgeIds.size
    || [...first.edgeIds][0]!.localeCompare([...second.edgeIds][0]!));
}

function selectPrimaryStructuralTopology(
  topology: LocalWallTopology,
  widthPx: number,
  heightPx: number,
): LocalWallTopology {
  const components = topologyComponents(topology);
  if (components.length <= 1) return topology;
  const ranked = [...components].sort((first, second) => {
    const firstStructural = first.edgeIds.size >= 3
      && (first.maximumX - first.minimumX) / widthPx >= 0.25
      && (first.maximumY - first.minimumY) / heightPx >= 0.25;
    const secondStructural = second.edgeIds.size >= 3
      && (second.maximumX - second.minimumX) / widthPx >= 0.25
      && (second.maximumY - second.minimumY) / heightPx >= 0.25;
    return Number(secondStructural) - Number(firstStructural)
      || second.totalLengthPx - first.totalLengthPx
      || second.edgeIds.size - first.edgeIds.size
      || [...first.edgeIds][0]!.localeCompare([...second.edgeIds][0]!);
  });
  const primary = ranked[0]!;
  if (primary.edgeIds.size < 3) return topology;
  const edges = topology.edges
    .filter((edge) => primary.edgeIds.has(edge.id))
    .map((edge) => ({
      ...edge,
      reasons: [...new Set([...edge.reasons, "primary-structural-component"])].sort(),
    }));
  const degreeByJunction = new Map<string, number>();
  for (const edge of edges) {
    degreeByJunction.set(edge.startJunctionId, (degreeByJunction.get(edge.startJunctionId) ?? 0) + 1);
    degreeByJunction.set(edge.endJunctionId, (degreeByJunction.get(edge.endJunctionId) ?? 0) + 1);
  }
  return {
    edges,
    junctions: topology.junctions
      .filter((junction) => degreeByJunction.has(junction.id))
      .map((junction) => ({ ...junction, degree: degreeByJunction.get(junction.id) ?? 0 })),
    diagnostics: topology.diagnostics.filter(
      (diagnostic) => diagnostic.edgeId === null || primary.edgeIds.has(diagnostic.edgeId),
    ),
  };
}

function provisionalCandidates(
  topology: LocalWallTopology,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate[] {
  return topologyWallCandidates({ topology, widthPx, heightPx }).map((candidate) => ({
    ...candidate,
    confidence: candidate.confidence === "low" ? "low" : "medium",
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.72, 0.72),
      reasons: [...new Set([...candidate.evidence.reasons, "provisional-topology-confidence"])].sort(),
    },
  }));
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
  const pairedCenterlines: LocalWallCenterline[] = [];
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const candidate = pairCenterline(segments[firstIndex]!, segments[secondIndex]!, options);
      if (candidate) pairedCenterlines.push(candidate);
    }
  }
  const centerlines = mergeCenterlineFragments(pairedCenterlines, options);
  const thicknessFilteredCenterlines = selectDominantWallThicknessCenterlines({
    centerlines,
    binWidthPx: Math.max(2, options.collinearOffsetTolerancePx),
  });
  const fullTopology = buildLocalWallTopology({
    centerlines: thicknessFilteredCenterlines,
    endpointSnapTolerancePx: options.endpointSnapTolerancePx,
    endpointExtensionTolerancePx: options.endpointExtensionTolerancePx,
    intersectionTolerancePx: options.intersectionTolerancePx,
    minimumEdgeLengthPx: options.minimumTopologyEdgeLengthPx,
  });
  const topology = selectPrimaryStructuralTopology(fullTopology, widthPx, heightPx);
  return {
    inputSegmentCount: input.segments.length,
    normalisedSegmentCount: normalised.length,
    pairedCenterlineCount: pairedCenterlines.length,
    consolidatedCenterlineCount: centerlines.length,
    thicknessFilteredCenterlineCount: thicknessFilteredCenterlines.length,
    topology,
    candidates: provisionalCandidates(topology, widthPx, heightPx),
  };
}

export function buildWallCandidates(input: BuildWallCandidatesInput): RecognitionWallCandidate[] {
  return [...analyzeWallCandidates(input).candidates];
}
