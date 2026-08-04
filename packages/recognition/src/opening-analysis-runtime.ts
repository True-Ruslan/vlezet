import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningAnalysisResult,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
import {
  analyzeOpeningHypotheses as analyzeOpeningHypothesesBase,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";

type Point = Readonly<{ x: number; y: number }>;

const MAX_CROSS_HOST_DEDUP_WALLS = 128;
const MAX_CROSS_HOST_ANGLE_DELTA_DEG = 8;
const MIN_CROSS_HOST_AXIS_TOLERANCE_PX = 4;
const MAX_CROSS_HOST_AXIS_TOLERANCE_PX = 8;
const EPSILON = 1e-7;

function pixelPoint(
  point: Readonly<{ x: number; y: number }>,
  widthPx: number,
  heightPx: number,
): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function vectorLength(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

function angleDelta(first: Point, second: Point): number {
  const firstLength = vectorLength(first);
  const secondLength = vectorLength(second);
  if (firstLength <= EPSILON || secondLength <= EPSILON) return 180;
  const cosine = Math.max(-1, Math.min(1, Math.abs(dot(first, second) / (firstLength * secondLength))));
  return Math.acos(cosine) * 180 / Math.PI;
}

function hostWallsCollinear(
  first: RecognitionWallCandidate,
  second: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): boolean {
  if (first.conflict !== null || second.conflict !== null) return false;
  const firstStart = pixelPoint(first.start, widthPx, heightPx);
  const firstEnd = pixelPoint(first.end, widthPx, heightPx);
  const secondStart = pixelPoint(second.start, widthPx, heightPx);
  const secondEnd = pixelPoint(second.end, widthPx, heightPx);
  const firstVector = subtract(firstEnd, firstStart);
  const secondVector = subtract(secondEnd, secondStart);
  const firstLength = vectorLength(firstVector);
  if (firstLength <= EPSILON || angleDelta(firstVector, secondVector) > MAX_CROSS_HOST_ANGLE_DELTA_DEG) return false;

  const tangent = { x: firstVector.x / firstLength, y: firstVector.y / firstLength };
  const normal = { x: -tangent.y, y: tangent.x };
  const firstThickness = first.estimatedThicknessPx ?? 16;
  const secondThickness = second.estimatedThicknessPx ?? 16;
  const axisTolerancePx = Math.max(
    MIN_CROSS_HOST_AXIS_TOLERANCE_PX,
    Math.min(
      MAX_CROSS_HOST_AXIS_TOLERANCE_PX,
      Math.min(firstThickness, secondThickness) * 0.35,
    ),
  );
  const secondStartRelative = subtract(secondStart, firstStart);
  const secondEndRelative = subtract(secondEnd, firstStart);
  return Math.abs(dot(secondStartRelative, normal)) <= axisTolerancePx
    && Math.abs(dot(secondEndRelative, normal)) <= axisTolerancePx;
}

function kindsCompatible(
  first: RecognitionOpeningCandidate,
  second: RecognitionOpeningCandidate,
): boolean {
  return first.kind === second.kind
    || first.kind === "unknown-opening"
    || second.kind === "unknown-opening";
}

function geometricallyEquivalent(
  first: RecognitionOpeningCandidate,
  second: RecognitionOpeningCandidate,
  widthPx: number,
  heightPx: number,
): boolean {
  if (!kindsCompatible(first, second)) return false;
  const firstWidth = first.widthPx ?? 0;
  const secondWidth = second.widthPx ?? 0;
  if (firstWidth <= 0 || secondWidth <= 0) return false;
  const centerDistancePx = Math.hypot(
    (first.center.x - second.center.x) * widthPx,
    (first.center.y - second.center.y) * heightPx,
  );
  if (centerDistancePx > Math.max(12, Math.min(firstWidth, secondWidth) * 0.2)) return false;
  if (Math.abs(firstWidth - secondWidth) > Math.max(12, Math.min(firstWidth, secondWidth) * 0.25)) return false;
  if (
    first.orientationDeg !== null
    && second.orientationDeg !== null
    && Number.isFinite(first.orientationDeg)
    && Number.isFinite(second.orientationDeg)
  ) {
    const raw = Math.abs(first.orientationDeg - second.orientationDeg) % 180;
    if (Math.min(raw, 180 - raw) > MAX_CROSS_HOST_ANGLE_DELTA_DEG) return false;
  }
  return true;
}

function hypothesisRank(candidate: RecognitionOpeningCandidate): readonly [number, number, string] {
  const kindRank = candidate.kind === "unknown-opening" ? 0 : 1;
  return [kindRank, candidate.evidence.localScore ?? 0, candidate.id];
}

function stronger(
  first: RecognitionOpeningCandidate,
  second: RecognitionOpeningCandidate,
): RecognitionOpeningCandidate {
  const firstRank = hypothesisRank(first);
  const secondRank = hypothesisRank(second);
  if (firstRank[0] !== secondRank[0]) return firstRank[0] > secondRank[0] ? first : second;
  if (firstRank[1] !== secondRank[1]) return firstRank[1] > secondRank[1] ? first : second;
  return firstRank[2].localeCompare(secondRank[2]) <= 0 ? first : second;
}

function mergeEquivalent(
  preferred: RecognitionOpeningCandidate,
  other: RecognitionOpeningCandidate,
): RecognitionOpeningCandidate {
  return {
    ...preferred,
    evidence: {
      localScore: Math.max(preferred.evidence.localScore ?? 0, other.evidence.localScore ?? 0),
      cloudScore: preferred.evidence.cloudScore ?? other.evidence.cloudScore,
      reasons: [...new Set([
        ...preferred.evidence.reasons,
        ...other.evidence.reasons,
        "opening-hypothesis-deduplicated",
      ])].sort(),
    },
  };
}

function deduplicateAcrossHosts(
  result: OpeningAnalysisResult,
  walls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): OpeningAnalysisResult {
  if (walls.length > MAX_CROSS_HOST_DEDUP_WALLS || result.candidates.length < 2) return result;
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  const candidates: RecognitionOpeningCandidate[] = [];

  for (const candidate of [...result.candidates].sort((first, second) => first.id.localeCompare(second.id))) {
    const host = candidate.hostWallCandidateId === null
      ? null
      : wallsById.get(candidate.hostWallCandidateId) ?? null;
    const duplicateIndex = candidates.findIndex((existing) => {
      if (existing.hostWallCandidateId === candidate.hostWallCandidateId) return false;
      if (!geometricallyEquivalent(existing, candidate, widthPx, heightPx)) return false;
      const existingHost = existing.hostWallCandidateId === null
        ? null
        : wallsById.get(existing.hostWallCandidateId) ?? null;
      return host !== null
        && existingHost !== null
        && hostWallsCollinear(existingHost, host, widthPx, heightPx);
    });
    if (duplicateIndex < 0) {
      candidates.push(candidate);
      continue;
    }
    const preferred = stronger(candidates[duplicateIndex]!, candidate);
    const other = preferred === candidates[duplicateIndex] ? candidate : candidates[duplicateIndex]!;
    candidates[duplicateIndex] = mergeEquivalent(preferred, other);
  }

  return {
    candidates: candidates.sort((first, second) => first.id.localeCompare(second.id)),
    rejections: result.rejections,
  };
}

export function validateOpeningHypotheses(
  input: ValidateOpeningHypothesesInput,
): OpeningAnalysisResult {
  return deduplicateAcrossHosts(
    validateOpeningHypothesesBase(input),
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  );
}

export function analyzeOpeningHypotheses(
  input: AnalyzeOpeningHypothesesInput,
): OpeningAnalysisResult {
  const continuousDoorOpenings = input.structuralMask
    ? detectContinuousHostDoorOpenings({
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        wallCandidates: input.wallCandidates,
        symbolSegments: input.symbolSegments ?? input.segments ?? [],
        mask: input.structuralMask,
      })
    : { openingHypotheses: [], diagnostics: [] };
  return deduplicateAcrossHosts(
    analyzeOpeningHypothesesBase({
      ...input,
      additionalHypotheses: [
        ...(input.additionalHypotheses ?? []),
        ...continuousDoorOpenings.openingHypotheses,
      ],
    }),
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  );
}
