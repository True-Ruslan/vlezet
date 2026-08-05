import { DEFAULT_OPENING_ANALYSIS_OPTIONS } from "./opening-analysis";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningAnalysisResult,
  OpeningHypothesisRejection,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
import {
  analyzeOpeningHypotheses as analyzeOpeningHypothesesBase,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis-runtime";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { createWindowHostOpeningHypotheses } from "./window-host-opening-hypotheses";

type Point = Readonly<{ x: number; y: number }>;
type Interval = Readonly<{ minimum: number; maximum: number }>;
type CornerExtension = Readonly<{
  startExtensionPx: number;
  endExtensionPx: number;
}>;
type RetryOpeningInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  options?: ValidateOpeningHypothesesInput["options"];
}>;

const MAX_HOST_CHAIN_WALLS = 128;
const MAX_HOST_CHAIN_GAP_PX = 16;
const MAX_HOST_CHAIN_ANGLE_DELTA_DEG = 8;
const MIN_HOST_CHAIN_AXIS_TOLERANCE_PX = 4;
const MAX_HOST_CHAIN_AXIS_TOLERANCE_PX = 8;
const MIN_HOST_CHAIN_THICKNESS_TOLERANCE_PX = 8;
const MIN_CORNER_ANCHOR_ANGLE_DELTA_DEG = 70;
const MIN_CORNER_ANCHOR_LENGTH_PX = 48;
const MIN_CORNER_ENDPOINT_TOLERANCE_PX = 4;
const MAX_CORNER_ENDPOINT_TOLERANCE_PX = 16;
const CORNER_EXTENSION_EPSILON_PX = 0.5;
const EPSILON = 1e-7;

function pixelPoint(
  point: RecognitionWallCandidate["start"],
  widthPx: number,
  heightPx: number,
): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
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

function vectorLength(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

function angleDeltaDeg(first: Point, second: Point): number {
  const firstLength = vectorLength(first);
  const secondLength = vectorLength(second);
  if (firstLength <= EPSILON || secondLength <= EPSILON) return 180;
  const cosine = Math.max(-1, Math.min(1, Math.abs(dot(first, second) / (firstLength * secondLength))));
  return Math.acos(cosine) * 180 / Math.PI;
}

function distancePointToSegment(
  point: Point,
  start: Point,
  end: Point,
): number {
  const segment = subtract(end, start);
  const segmentLengthSquared = dot(segment, segment);
  if (segmentLengthSquared <= EPSILON) return vectorLength(subtract(point, start));
  const projection = Math.max(
    0,
    Math.min(1, dot(subtract(point, start), segment) / segmentLengthSquared),
  );
  return vectorLength(subtract(point, add(start, scale(segment, projection))));
}

function exactWindowProposal(candidate: RecognitionOpeningCandidate): boolean {
  return candidate.kind === "window"
    && candidate.evidence.reasons.includes("paired-window-rails")
    && candidate.evidence.reasons.includes("window-host-proposal-evidence");
}

function hasPerpendicularCornerAnchor(
  host: RecognitionWallCandidate,
  endpoint: Point,
  walls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): boolean {
  const hostStart = pixelPoint(host.start, widthPx, heightPx);
  const hostEnd = pixelPoint(host.end, widthPx, heightPx);
  const hostVector = subtract(hostEnd, hostStart);
  const hostThicknessPx = host.estimatedThicknessPx ?? 16;

  return walls.some((candidate) => {
    if (candidate.id === host.id || candidate.conflict !== null) return false;
    const candidateStart = pixelPoint(candidate.start, widthPx, heightPx);
    const candidateEnd = pixelPoint(candidate.end, widthPx, heightPx);
    const candidateVector = subtract(candidateEnd, candidateStart);
    const candidateLengthPx = vectorLength(candidateVector);
    if (
      candidateLengthPx < MIN_CORNER_ANCHOR_LENGTH_PX
      || angleDeltaDeg(hostVector, candidateVector) < MIN_CORNER_ANCHOR_ANGLE_DELTA_DEG
    ) return false;

    const candidateThicknessPx = candidate.estimatedThicknessPx ?? 16;
    const endpointTolerancePx = Math.max(
      MIN_CORNER_ENDPOINT_TOLERANCE_PX,
      Math.min(
        MAX_CORNER_ENDPOINT_TOLERANCE_PX,
        Math.max(hostThicknessPx, candidateThicknessPx) / 2 + 2,
      ),
    );
    return distancePointToSegment(endpoint, candidateStart, candidateEnd) <= endpointTolerancePx;
  });
}

function cornerExtensionForRejection(
  rejection: OpeningHypothesisRejection,
  host: RecognitionWallCandidate,
  input: RetryOpeningInput,
): CornerExtension | null {
  if (
    rejection.code !== "opening-end-margin"
    || !exactWindowProposal(rejection.candidate)
    || host.conflict !== null
  ) return null;

  const hostStart = pixelPoint(host.start, input.widthPx, input.heightPx);
  const hostEnd = pixelPoint(host.end, input.widthPx, input.heightPx);
  const hostVector = subtract(hostEnd, hostStart);
  const hostLengthPx = vectorLength(hostVector);
  const openingWidthPx = rejection.candidate.widthPx;
  if (
    !Number.isFinite(hostLengthPx)
    || hostLengthPx <= EPSILON
    || openingWidthPx === null
    || !Number.isFinite(openingWidthPx)
    || openingWidthPx <= 0
  ) return null;

  const tangent = { x: hostVector.x / hostLengthPx, y: hostVector.y / hostLengthPx };
  const center = pixelPoint(rejection.candidate.center, input.widthPx, input.heightPx);
  const centerAlongPx = dot(subtract(center, hostStart), tangent);
  const halfWidthPx = openingWidthPx / 2;
  const startMarginPx = centerAlongPx - halfWidthPx;
  const endMarginPx = hostLengthPx - (centerAlongPx + halfWidthPx);
  const minimumEndMarginPx = input.options?.minimumEndMarginPx
    ?? DEFAULT_OPENING_ANALYSIS_OPTIONS.minimumEndMarginPx;
  const startDeficient = startMarginPx < minimumEndMarginPx;
  const endDeficient = endMarginPx < minimumEndMarginPx;
  if (startDeficient === endDeficient) return null;

  const deficientEndpoint = startDeficient ? hostStart : hostEnd;
  if (!hasPerpendicularCornerAnchor(
    host,
    deficientEndpoint,
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  )) return null;

  return startDeficient
    ? {
        startExtensionPx: minimumEndMarginPx - startMarginPx + CORNER_EXTENSION_EPSILON_PX,
        endExtensionPx: 0,
      }
    : {
        startExtensionPx: 0,
        endExtensionPx: minimumEndMarginPx - endMarginPx + CORNER_EXTENSION_EPSILON_PX,
      };
}

function extendedHostForCorner(
  host: RecognitionWallCandidate,
  extension: CornerExtension,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate | null {
  const hostStart = pixelPoint(host.start, widthPx, heightPx);
  const hostEnd = pixelPoint(host.end, widthPx, heightPx);
  const hostVector = subtract(hostEnd, hostStart);
  const hostLengthPx = vectorLength(hostVector);
  if (!Number.isFinite(hostLengthPx) || hostLengthPx <= EPSILON) return null;

  const tangent = { x: hostVector.x / hostLengthPx, y: hostVector.y / hostLengthPx };
  const extendedStart = add(hostStart, scale(tangent, -extension.startExtensionPx));
  const extendedEnd = add(hostEnd, scale(tangent, extension.endExtensionPx));
  return {
    ...host,
    start: {
      x: Math.max(0, Math.min(1, extendedStart.x / widthPx)),
      y: Math.max(0, Math.min(1, extendedStart.y / heightPx)),
    },
    end: {
      x: Math.max(0, Math.min(1, extendedEnd.x / widthPx)),
      y: Math.max(0, Math.min(1, extendedEnd.y / heightPx)),
    },
  };
}

function thicknessCompatible(
  first: RecognitionWallCandidate,
  second: RecognitionWallCandidate,
): boolean {
  const firstThickness = first.estimatedThicknessPx;
  const secondThickness = second.estimatedThicknessPx;
  if (
    firstThickness === null
    || secondThickness === null
    || !Number.isFinite(firstThickness)
    || !Number.isFinite(secondThickness)
  ) return true;
  return Math.abs(firstThickness - secondThickness)
    <= Math.max(MIN_HOST_CHAIN_THICKNESS_TOLERANCE_PX, Math.min(firstThickness, secondThickness) * 0.5);
}

function extendedHostForChain(
  host: RecognitionWallCandidate,
  walls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate | null {
  if (walls.length > MAX_HOST_CHAIN_WALLS || host.conflict !== null) return null;

  const hostStart = pixelPoint(host.start, widthPx, heightPx);
  const hostEnd = pixelPoint(host.end, widthPx, heightPx);
  const hostVector = subtract(hostEnd, hostStart);
  const hostLengthPx = vectorLength(hostVector);
  if (!Number.isFinite(hostLengthPx) || hostLengthPx <= EPSILON) return null;

  const tangent = { x: hostVector.x / hostLengthPx, y: hostVector.y / hostLengthPx };
  const normal = { x: -tangent.y, y: tangent.x };
  const hostThickness = host.estimatedThicknessPx ?? 16;
  const intervals: Interval[] = [{ minimum: 0, maximum: hostLengthPx }];

  for (const candidate of walls) {
    if (candidate.id === host.id || candidate.conflict !== null) continue;
    if (!thicknessCompatible(host, candidate)) continue;

    const candidateStart = pixelPoint(candidate.start, widthPx, heightPx);
    const candidateEnd = pixelPoint(candidate.end, widthPx, heightPx);
    const candidateVector = subtract(candidateEnd, candidateStart);
    if (angleDeltaDeg(hostVector, candidateVector) > MAX_HOST_CHAIN_ANGLE_DELTA_DEG) continue;

    const candidateThickness = candidate.estimatedThicknessPx ?? 16;
    const axisTolerancePx = Math.max(
      MIN_HOST_CHAIN_AXIS_TOLERANCE_PX,
      Math.min(
        MAX_HOST_CHAIN_AXIS_TOLERANCE_PX,
        Math.min(hostThickness, candidateThickness) * 0.25,
      ),
    );
    const startRelative = subtract(candidateStart, hostStart);
    const endRelative = subtract(candidateEnd, hostStart);
    if (
      Math.abs(dot(startRelative, normal)) > axisTolerancePx
      || Math.abs(dot(endRelative, normal)) > axisTolerancePx
    ) continue;

    const startAlongPx = dot(startRelative, tangent);
    const endAlongPx = dot(endRelative, tangent);
    intervals.push({
      minimum: Math.min(startAlongPx, endAlongPx),
      maximum: Math.max(startAlongPx, endAlongPx),
    });
  }

  let chainMinimum = 0;
  let chainMaximum = hostLengthPx;
  let changed = true;
  while (changed) {
    changed = false;
    for (const interval of intervals) {
      if (
        interval.maximum < chainMinimum - MAX_HOST_CHAIN_GAP_PX
        || interval.minimum > chainMaximum + MAX_HOST_CHAIN_GAP_PX
      ) continue;
      const nextMinimum = Math.min(chainMinimum, interval.minimum);
      const nextMaximum = Math.max(chainMaximum, interval.maximum);
      if (nextMinimum < chainMinimum - EPSILON || nextMaximum > chainMaximum + EPSILON) {
        chainMinimum = nextMinimum;
        chainMaximum = nextMaximum;
        changed = true;
      }
    }
  }

  if (chainMinimum >= -EPSILON && chainMaximum <= hostLengthPx + EPSILON) return null;
  const extendedStart = add(hostStart, scale(tangent, chainMinimum));
  const extendedEnd = add(hostStart, scale(tangent, chainMaximum));
  return {
    ...host,
    start: {
      x: Math.max(0, Math.min(1, extendedStart.x / widthPx)),
      y: Math.max(0, Math.min(1, extendedStart.y / heightPx)),
    },
    end: {
      x: Math.max(0, Math.min(1, extendedEnd.x / widthPx)),
      y: Math.max(0, Math.min(1, extendedEnd.y / heightPx)),
    },
  };
}

function retryableWindowRejection(rejection: OpeningHypothesisRejection): boolean {
  return rejection.code === "opening-outside-host-span"
    && rejection.hostWallCandidateId !== null
    && rejection.candidate.evidence.reasons.includes("window-host-proposal-evidence");
}

function markChainValidated(candidate: RecognitionOpeningCandidate): RecognitionOpeningCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "host-wall-chain-validated",
      ])].sort(),
    },
  };
}

function retryWindowHostChains(
  result: OpeningAnalysisResult,
  input: RetryOpeningInput,
): OpeningAnalysisResult {
  const wallsById = new Map(input.wallCandidates.map((wall) => [wall.id, wall]));
  const extendedById = new Map<string, RecognitionWallCandidate>();
  const retryCandidates: RecognitionOpeningCandidate[] = [];
  const retryIds = new Set<string>();

  for (const rejection of result.rejections) {
    if (!retryableWindowRejection(rejection)) continue;
    const hostId = rejection.hostWallCandidateId!;
    const host = wallsById.get(hostId);
    if (!host) continue;
    const extended = extendedHostForChain(
      host,
      input.wallCandidates,
      input.widthPx,
      input.heightPx,
    );
    if (!extended) continue;
    extendedById.set(hostId, extended);
    retryCandidates.push(rejection.candidate);
    retryIds.add(rejection.candidateId);
  }

  if (retryCandidates.length === 0) return result;
  const validationWalls = input.wallCandidates.map((wall) => extendedById.get(wall.id) ?? wall);
  const retried = validateOpeningHypothesesBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: validationWalls,
    hypotheses: [...result.candidates, ...retryCandidates],
    options: input.options,
  });
  const candidates = retried.candidates
    .map((candidate) => retryIds.has(candidate.id) ? markChainValidated(candidate) : candidate)
    .sort((first, second) => first.id.localeCompare(second.id));
  const retainedRejections = result.rejections.filter((rejection) => !retryIds.has(rejection.candidateId));
  const rejections = [...retainedRejections, ...retried.rejections]
    .sort((first, second) =>
      first.candidateId.localeCompare(second.candidateId)
      || first.code.localeCompare(second.code));
  return { candidates, rejections };
}

function markCornerValidated(candidate: RecognitionOpeningCandidate): RecognitionOpeningCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "perpendicular-corner-terminated",
      ])].sort(),
    },
  };
}

function retryCornerTerminatedWindows(
  result: OpeningAnalysisResult,
  input: RetryOpeningInput,
): OpeningAnalysisResult {
  const wallsById = new Map(input.wallCandidates.map((wall) => [wall.id, wall]));
  const extensionsById = new Map<string, CornerExtension>();
  const retryCandidates: RecognitionOpeningCandidate[] = [];
  const retryIds = new Set<string>();

  for (const rejection of result.rejections) {
    const hostId = rejection.hostWallCandidateId;
    if (hostId === null) continue;
    const host = wallsById.get(hostId);
    if (!host) continue;
    const extension = cornerExtensionForRejection(rejection, host, input);
    if (!extension) continue;
    const current = extensionsById.get(hostId) ?? {
      startExtensionPx: 0,
      endExtensionPx: 0,
    };
    extensionsById.set(hostId, {
      startExtensionPx: Math.max(current.startExtensionPx, extension.startExtensionPx),
      endExtensionPx: Math.max(current.endExtensionPx, extension.endExtensionPx),
    });
    retryCandidates.push(rejection.candidate);
    retryIds.add(rejection.candidateId);
  }

  if (retryCandidates.length === 0) return result;
  const validationWalls = input.wallCandidates.map((wall) => {
    const extension = extensionsById.get(wall.id);
    return extension
      ? extendedHostForCorner(wall, extension, input.widthPx, input.heightPx) ?? wall
      : wall;
  });
  const retried = validateOpeningHypothesesBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: validationWalls,
    hypotheses: [...result.candidates, ...retryCandidates],
    options: input.options,
  });
  const candidates = retried.candidates
    .map((candidate) => retryIds.has(candidate.id) ? markCornerValidated(candidate) : candidate)
    .sort((first, second) => first.id.localeCompare(second.id));
  const retainedRejections = result.rejections.filter((rejection) => !retryIds.has(rejection.candidateId));
  const rejections = [...retainedRejections, ...retried.rejections]
    .sort((first, second) =>
      first.candidateId.localeCompare(second.candidateId)
      || first.code.localeCompare(second.code));
  return { candidates, rejections };
}

export function validateOpeningHypotheses(
  input: ValidateOpeningHypothesesInput,
): OpeningAnalysisResult {
  return retryCornerTerminatedWindows(
    retryWindowHostChains(
      validateOpeningHypothesesBase(input),
      input,
    ),
    input,
  );
}

export function analyzeOpeningHypotheses(
  input: AnalyzeOpeningHypothesesInput,
): OpeningAnalysisResult {
  const windowHostProposals = createWindowHostOpeningHypotheses({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
  });
  const result = analyzeOpeningHypothesesBase({
    ...input,
    additionalHypotheses: [
      ...(input.additionalHypotheses ?? []),
      ...windowHostProposals,
    ],
  });
  return retryCornerTerminatedWindows(
    retryWindowHostChains(result, input),
    input,
  );
}
