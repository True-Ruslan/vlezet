import type { DetectedLineSegment } from "./local-lines";
import type {
  NormalizedPoint,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { buildOpeningHypotheses } from "./openings";

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
  const hypotheses = buildOpeningHypotheses({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    segments: input.segments,
    wallSegments: input.wallSegments,
    symbolSegments: input.symbolSegments,
  });
  return validateOpeningHypotheses({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    hypotheses,
    options: input.options,
  });
}
