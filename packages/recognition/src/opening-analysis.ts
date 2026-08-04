import type { DetectedLineSegment } from "./local-lines";
import type {
  NormalizedPoint,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { buildOpeningHypotheses } from "./openings";
import type { StructuralMaskView } from "./wall-completion";
import { detectMaskSupportedWindows } from "./window-mask-analysis";

export type OpeningHypothesisRejectionCode =
  | "unknown-host-wall"
  | "invalid-host-wall"
  | "invalid-opening-width"
  | "opening-too-far-from-host"
  | "opening-outside-host-span"
  | "opening-end-margin"
  | "opening-overlap";

export type OpeningHypothesisRejection = Readonly<{
  candidateId: string;
  hostWallCandidateId: string | null;
  code: OpeningHypothesisRejectionCode;
  message: string;
}>;

export type OpeningAnalysisOptions = Readonly<{
  minimumEndMarginPx: number;
  maximumCenterDistancePx: number;
  minimumOpeningWidthPx: number;
  maximumOpeningWidthPx: number;
  minimumOpeningSeparationPx: number;
}>;

export const DEFAULT_OPENING_ANALYSIS_OPTIONS: OpeningAnalysisOptions = Object.freeze({
  minimumEndMarginPx: 24,
  maximumCenterDistancePx: 24,
  minimumOpeningWidthPx: 30,
  maximumOpeningWidthPx: 240,
  minimumOpeningSeparationPx: 8,
});

export type ValidateOpeningHypothesesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  hypotheses: readonly RecognitionOpeningCandidate[];
  options?: Partial<OpeningAnalysisOptions>;
}>;

export type AnalyzeOpeningHypothesesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  segments?: readonly DetectedLineSegment[];
  wallSegments?: readonly DetectedLineSegment[];
  symbolSegments?: readonly DetectedLineSegment[];
  structuralMask?: StructuralMaskView;
  additionalHypotheses?: readonly RecognitionOpeningCandidate[];
  options?: Partial<OpeningAnalysisOptions>;
}>;

export type OpeningAnalysisResult = Readonly<{
  candidates: readonly RecognitionOpeningCandidate[];
  rejections: readonly OpeningHypothesisRejection[];
}>;

type Point = Readonly<{ x: number; y: number }>;

type PositionedHypothesis = Readonly<{
  candidate: RecognitionOpeningCandidate;
  host: RecognitionWallCandidate;
  centerAlongPx: number;
  startAlongPx: number;
  endAlongPx: number;
}>;

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} должен быть положительным конечным числом.`);
  }
  return value;
}

function pixelPoint(point: NormalizedPoint, widthPx: number, heightPx: number): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

function rejection(
  candidate: RecognitionOpeningCandidate,
  code: OpeningHypothesisRejectionCode,
  message: string,
): OpeningHypothesisRejection {
  return {
    candidateId: candidate.id,
    hostWallCandidateId: candidate.hostWallCandidateId,
    code,
    message,
  };
}

function positionedHypothesis(
  candidate: RecognitionOpeningCandidate,
  host: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
  options: OpeningAnalysisOptions,
): PositionedHypothesis | OpeningHypothesisRejection {
  const hostStart = pixelPoint(host.start, widthPx, heightPx);
  const hostEnd = pixelPoint(host.end, widthPx, heightPx);
  const hostVector = subtract(hostEnd, hostStart);
  const hostLengthPx = length(hostVector);
  if (!Number.isFinite(hostLengthPx) || hostLengthPx <= 0) {
    return rejection(candidate, "invalid-host-wall", "Несущая стена проёма имеет некорректную геометрию.");
  }

  const openingWidthPx = candidate.widthPx;
  if (
    openingWidthPx === null
    || !Number.isFinite(openingWidthPx)
    || openingWidthPx < options.minimumOpeningWidthPx
    || openingWidthPx > options.maximumOpeningWidthPx
  ) {
    return rejection(candidate, "invalid-opening-width", "Ширина проёма выходит за безопасный диапазон.");
  }

  const tangent = { x: hostVector.x / hostLengthPx, y: hostVector.y / hostLengthPx };
  const normal = { x: -tangent.y, y: tangent.x };
  const center = pixelPoint(candidate.center, widthPx, heightPx);
  const relativeCenter = subtract(center, hostStart);
  const centerAlongPx = dot(relativeCenter, tangent);
  const centerDistancePx = Math.abs(dot(relativeCenter, normal));
  const thicknessAwareDistancePx = Math.max(
    options.maximumCenterDistancePx,
    (host.estimatedThicknessPx ?? 0) / 2 + 4,
  );

  if (centerDistancePx > thicknessAwareDistancePx) {
    return rejection(candidate, "opening-too-far-from-host", "Центр проёма не лежит на выбранной стене.");
  }

  const halfWidthPx = openingWidthPx / 2;
  const startAlongPx = centerAlongPx - halfWidthPx;
  const endAlongPx = centerAlongPx + halfWidthPx;
  if (centerAlongPx < 0 || centerAlongPx > hostLengthPx || startAlongPx < 0 || endAlongPx > hostLengthPx) {
    return rejection(candidate, "opening-outside-host-span", "Проём выходит за границы выбранной стены.");
  }

  if (
    startAlongPx < options.minimumEndMarginPx
    || hostLengthPx - endAlongPx < options.minimumEndMarginPx
  ) {
    return rejection(candidate, "opening-end-margin", "Проём расположен слишком близко к углу или окончанию стены.");
  }

  return { candidate, host, centerAlongPx, startAlongPx, endAlongPx };
}

function acceptedCandidate(candidate: RecognitionOpeningCandidate): RecognitionOpeningCandidate {
  const reasons = [...new Set([
    ...candidate.evidence.reasons,
    "host-wall-validated",
    "opening-span-validated",
  ])].sort();
  return {
    ...candidate,
    confidence: candidate.kind === "unknown-opening" ? "low" : "medium",
    evidence: { ...candidate.evidence, reasons },
    conflict: null,
  };
}

function hypothesisRank(candidate: RecognitionOpeningCandidate): readonly [number, number, string] {
  const kindRank = candidate.kind === "unknown-opening" ? 0 : 1;
  return [kindRank, candidate.evidence.localScore ?? 0, candidate.id];
}

function strongerHypothesis(
  first: RecognitionOpeningCandidate,
  second: RecognitionOpeningCandidate,
): RecognitionOpeningCandidate {
  const firstRank = hypothesisRank(first);
  const secondRank = hypothesisRank(second);
  if (firstRank[0] !== secondRank[0]) return firstRank[0] > secondRank[0] ? first : second;
  if (firstRank[1] !== secondRank[1]) return firstRank[1] > secondRank[1] ? first : second;
  return firstRank[2].localeCompare(secondRank[2]) <= 0 ? first : second;
}

function equivalentHypotheses(
  first: RecognitionOpeningCandidate,
  second: RecognitionOpeningCandidate,
  widthPx: number,
  heightPx: number,
): boolean {
  if (first.hostWallCandidateId !== second.hostWallCandidateId) return false;
  if (first.kind !== second.kind && first.kind !== "unknown-opening" && second.kind !== "unknown-opening") return false;
  const centerDistancePx = Math.hypot(
    (first.center.x - second.center.x) * widthPx,
    (first.center.y - second.center.y) * heightPx,
  );
  const firstWidth = first.widthPx ?? 0;
  const secondWidth = second.widthPx ?? 0;
  return centerDistancePx <= Math.max(12, Math.min(firstWidth, secondWidth) * 0.2)
    && Math.abs(firstWidth - secondWidth) <= Math.max(12, Math.min(firstWidth, secondWidth) * 0.25);
}

function deduplicateHypotheses(
  hypotheses: readonly RecognitionOpeningCandidate[],
  widthPx: number,
  heightPx: number,
): RecognitionOpeningCandidate[] {
  const result: RecognitionOpeningCandidate[] = [];
  for (const candidate of [...hypotheses].sort((first, second) => first.id.localeCompare(second.id))) {
    const index = result.findIndex((existing) => equivalentHypotheses(
      existing,
      candidate,
      widthPx,
      heightPx,
    ));
    if (index < 0) {
      result.push(candidate);
      continue;
    }
    const preferred = strongerHypothesis(result[index]!, candidate);
    const other = preferred === result[index] ? candidate : result[index]!;
    result[index] = {
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
  return result.sort((first, second) => first.id.localeCompare(second.id));
}

export function validateOpeningHypotheses(
  input: ValidateOpeningHypothesesInput,
): OpeningAnalysisResult {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const options = { ...DEFAULT_OPENING_ANALYSIS_OPTIONS, ...input.options };
  const wallsById = new Map(input.wallCandidates.map((wall) => [wall.id, wall]));
  const positioned: PositionedHypothesis[] = [];
  const rejections: OpeningHypothesisRejection[] = [];

  for (const candidate of [...input.hypotheses].sort((first, second) => first.id.localeCompare(second.id))) {
    const host = candidate.hostWallCandidateId === null
      ? null
      : wallsById.get(candidate.hostWallCandidateId) ?? null;
    if (!host) {
      rejections.push(rejection(candidate, "unknown-host-wall", "Проём ссылается на неизвестную стену."));
      continue;
    }
    const result = positionedHypothesis(candidate, host, widthPx, heightPx, options);
    if ("code" in result) rejections.push(result);
    else positioned.push(result);
  }

  positioned.sort((first, second) =>
    first.host.id.localeCompare(second.host.id)
    || first.centerAlongPx - second.centerAlongPx
    || first.candidate.id.localeCompare(second.candidate.id));

  const accepted: PositionedHypothesis[] = [];
  for (const current of positioned) {
    const overlaps = accepted.some((previous) =>
      previous.host.id === current.host.id
      && current.startAlongPx < previous.endAlongPx + options.minimumOpeningSeparationPx
      && current.endAlongPx > previous.startAlongPx - options.minimumOpeningSeparationPx);
    if (overlaps) {
      rejections.push(rejection(
        current.candidate,
        "opening-overlap",
        "Проём пересекается с уже принятой гипотезой на той же стене.",
      ));
      continue;
    }
    accepted.push(current);
  }

  return {
    candidates: accepted.map((item) => acceptedCandidate(item.candidate)),
    rejections: rejections.sort((first, second) =>
      first.candidateId.localeCompare(second.candidateId)
      || first.code.localeCompare(second.code)),
  };
}

export function analyzeOpeningHypotheses(
  input: AnalyzeOpeningHypothesesInput,
): OpeningAnalysisResult {
  const symbolSegments = input.symbolSegments ?? input.segments ?? [];
  const existingHypotheses = buildOpeningHypotheses({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    segments: input.segments,
    wallSegments: input.wallSegments,
    symbolSegments,
  });
  const maskSupportedWindows = input.structuralMask
    ? detectMaskSupportedWindows({
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        wallCandidates: input.wallCandidates,
        symbolSegments,
        mask: input.structuralMask,
      })
    : [];
  const hypotheses = deduplicateHypotheses(
    [
      ...existingHypotheses,
      ...maskSupportedWindows,
      ...(input.additionalHypotheses ?? []),
    ],
    input.widthPx,
    input.heightPx,
  );
  return validateOpeningHypotheses({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    hypotheses,
    options: input.options,
  });
}