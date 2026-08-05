import {
  DEFAULT_OPENING_ANALYSIS_OPTIONS,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis";
import type {
  OpeningAnalysisResult,
  OpeningHypothesisRejection,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

type Point = Readonly<{ x: number; y: number }>;
type Interval = Readonly<{ minimum: number; maximum: number }>;
type HostExtension = Readonly<{
  startExtensionPx: number;
  endExtensionPx: number;
}>;
type RetryPlan = Readonly<{
  extension: HostExtension;
  validationReason: "host-wall-chain-validated" | "perpendicular-far-side-terminated";
}>;

const MAX_VALIDATION_WALLS = 128;
const MIN_PERPENDICULAR_ANGLE_DEG = 70;
const MIN_PERPENDICULAR_WALL_LENGTH_PX = 48;
const MIN_ENDPOINT_TOLERANCE_PX = 6;
const MAX_ENDPOINT_TOLERANCE_PX = 16;
const MIN_AXIS_TOLERANCE_PX = 4;
const MAX_AXIS_TOLERANCE_PX = 16;
const MAX_FAR_SIDE_MARGIN_PX = 96;
const MAX_HOST_CHAIN_GAP_PX = 16;
const MAX_HOST_CHAIN_ANGLE_DELTA_DEG = 8;
const MIN_HOST_CHAIN_AXIS_TOLERANCE_PX = 4;
const MAX_HOST_CHAIN_AXIS_TOLERANCE_PX = 8;
const MIN_HOST_CHAIN_THICKNESS_TOLERANCE_PX = 8;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

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

function exactTerminalDoor(rejection: OpeningHypothesisRejection): boolean {
  const reasons = rejection.candidate.evidence.reasons;
  return rejection.code === "opening-outside-host-span"
    && rejection.hostWallCandidateId !== null
    && rejection.candidate.kind === "door"
    && reasons.includes("continuous-host-mask-door-gap")
    && reasons.includes("door-leaf-anchored")
    && reasons.includes("perpendicular-door-leaf")
    && reasons.includes("terminal-host-mask-door-gap");
}

function openingSpanOnHost(
  rejection: OpeningHypothesisRejection,
  host: RecognitionWallCandidate,
  input: ValidateOpeningHypothesesInput,
): Readonly<{
  hostStart: Point;
  hostVector: Point;
  hostLengthPx: number;
  tangent: Point;
  normal: Point;
  openingStartAlongPx: number;
  openingEndAlongPx: number;
  startOutside: boolean;
  endOutside: boolean;
}> | null {
  if (!exactTerminalDoor(rejection) || input.wallCandidates.length > MAX_VALIDATION_WALLS) return null;

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
  const normal = { x: -tangent.y, y: tangent.x };
  const center = pixelPoint(rejection.candidate.center, input.widthPx, input.heightPx);
  const centerAlongPx = dot(subtract(center, hostStart), tangent);
  const halfWidthPx = openingWidthPx / 2;
  const openingStartAlongPx = centerAlongPx - halfWidthPx;
  const openingEndAlongPx = centerAlongPx + halfWidthPx;
  const startOutside = openingStartAlongPx < -EPSILON;
  const endOutside = openingEndAlongPx > hostLengthPx + EPSILON;
  if (startOutside === endOutside) return null;

  const endpointTolerancePx = Math.max(
    MIN_ENDPOINT_TOLERANCE_PX,
    Math.min(MAX_ENDPOINT_TOLERANCE_PX, (host.estimatedThicknessPx ?? 16) / 2 + 2),
  );
  if (
    startOutside
      ? Math.abs(openingEndAlongPx) > endpointTolerancePx
      : Math.abs(openingStartAlongPx - hostLengthPx) > endpointTolerancePx
  ) return null;

  return {
    hostStart,
    hostVector,
    hostLengthPx,
    tangent,
    normal,
    openingStartAlongPx,
    openingEndAlongPx,
    startOutside,
    endOutside,
  };
}

function perpendicularIntersectionAlong(
  host: RecognitionWallCandidate,
  candidate: RecognitionWallCandidate,
  hostStart: Point,
  hostVector: Point,
  tangent: Point,
  normal: Point,
  widthPx: number,
  heightPx: number,
): number | null {
  if (candidate.id === host.id || candidate.conflict !== null) return null;
  const candidateStart = pixelPoint(candidate.start, widthPx, heightPx);
  const candidateEnd = pixelPoint(candidate.end, widthPx, heightPx);
  const candidateVector = subtract(candidateEnd, candidateStart);
  if (
    vectorLength(candidateVector) < MIN_PERPENDICULAR_WALL_LENGTH_PX
    || angleDeltaDeg(hostVector, candidateVector) < MIN_PERPENDICULAR_ANGLE_DEG
  ) return null;

  const firstRelative = subtract(candidateStart, hostStart);
  const secondRelative = subtract(candidateEnd, hostStart);
  const firstAcross = dot(firstRelative, normal);
  const secondAcross = dot(secondRelative, normal);
  const hostThicknessPx = host.estimatedThicknessPx ?? 16;
  const candidateThicknessPx = candidate.estimatedThicknessPx ?? 16;
  const axisTolerancePx = Math.max(
    MIN_AXIS_TOLERANCE_PX,
    Math.min(
      MAX_AXIS_TOLERANCE_PX,
      (hostThicknessPx + candidateThicknessPx) / 2 + 2,
    ),
  );
  if (
    Math.min(Math.abs(firstAcross), Math.abs(secondAcross)) > axisTolerancePx
    && firstAcross * secondAcross > 0
  ) return null;

  const denominator = firstAcross - secondAcross;
  const ratio = Math.abs(denominator) <= EPSILON ? 0.5 : firstAcross / denominator;
  if (ratio < -0.05 || ratio > 1.05) return null;
  const intersection = add(candidateStart, scale(candidateVector, ratio));
  return dot(subtract(intersection, hostStart), tangent);
}

function perpendicularExtensionForRejection(
  rejection: OpeningHypothesisRejection,
  host: RecognitionWallCandidate,
  input: ValidateOpeningHypothesesInput,
): HostExtension | null {
  const span = openingSpanOnHost(rejection, host, input);
  if (!span) return null;

  const minimumEndMarginPx = input.options?.minimumEndMarginPx
    ?? DEFAULT_OPENING_ANALYSIS_OPTIONS.minimumEndMarginPx;
  const eligibleIntersections = input.wallCandidates
    .map((candidate) => perpendicularIntersectionAlong(
      host,
      candidate,
      span.hostStart,
      span.hostVector,
      span.tangent,
      span.normal,
      input.widthPx,
      input.heightPx,
    ))
    .filter((alongPx): alongPx is number => alongPx !== null && Number.isFinite(alongPx))
    .map((alongPx) => ({
      alongPx,
      marginPx: span.startOutside
        ? span.openingStartAlongPx - alongPx
        : alongPx - span.openingEndAlongPx,
    }))
    .filter(({ marginPx }) =>
      marginPx + EPSILON >= minimumEndMarginPx
      && marginPx <= MAX_FAR_SIDE_MARGIN_PX + EPSILON)
    .sort((first, second) => first.marginPx - second.marginPx || first.alongPx - second.alongPx);
  const anchor = eligibleIntersections[0];
  if (!anchor) return null;

  return span.startOutside
    ? {
        startExtensionPx: Math.max(0, -anchor.alongPx),
        endExtensionPx: 0,
      }
    : {
        startExtensionPx: 0,
        endExtensionPx: Math.max(0, anchor.alongPx - span.hostLengthPx),
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
    <= Math.max(
      MIN_HOST_CHAIN_THICKNESS_TOLERANCE_PX,
      Math.min(firstThickness, secondThickness) * 0.5,
    );
}

function eligibleDoorChainWall(candidate: RecognitionWallCandidate): boolean {
  const reasons = candidate.evidence.reasons;
  return reasons.includes("topology-mask-opening-gap-confidence-capped")
    && reasons.includes("bounded-opening-gap-bridge");
}

function chainExtensionForRejection(
  rejection: OpeningHypothesisRejection,
  host: RecognitionWallCandidate,
  input: ValidateOpeningHypothesesInput,
): HostExtension | null {
  if (!rejection.candidate.evidence.reasons.includes("door-host-residual")) return null;
  const span = openingSpanOnHost(rejection, host, input);
  if (!span || host.conflict !== null) return null;

  const hostThicknessPx = host.estimatedThicknessPx ?? 16;
  const intervals: Interval[] = [{ minimum: 0, maximum: span.hostLengthPx }];
  for (const candidate of input.wallCandidates) {
    if (
      candidate.id === host.id
      || candidate.conflict !== null
      || !eligibleDoorChainWall(candidate)
      || !thicknessCompatible(host, candidate)
    ) continue;

    const candidateStart = pixelPoint(candidate.start, input.widthPx, input.heightPx);
    const candidateEnd = pixelPoint(candidate.end, input.widthPx, input.heightPx);
    const candidateVector = subtract(candidateEnd, candidateStart);
    if (angleDeltaDeg(span.hostVector, candidateVector) > MAX_HOST_CHAIN_ANGLE_DELTA_DEG) continue;

    const candidateThicknessPx = candidate.estimatedThicknessPx ?? 16;
    const axisTolerancePx = Math.max(
      MIN_HOST_CHAIN_AXIS_TOLERANCE_PX,
      Math.min(
        MAX_HOST_CHAIN_AXIS_TOLERANCE_PX,
        Math.min(hostThicknessPx, candidateThicknessPx) * 0.25,
      ),
    );
    const firstRelative = subtract(candidateStart, span.hostStart);
    const secondRelative = subtract(candidateEnd, span.hostStart);
    if (
      Math.abs(dot(firstRelative, span.normal)) > axisTolerancePx
      || Math.abs(dot(secondRelative, span.normal)) > axisTolerancePx
    ) continue;

    const firstAlongPx = dot(firstRelative, span.tangent);
    const secondAlongPx = dot(secondRelative, span.tangent);
    intervals.push({
      minimum: Math.min(firstAlongPx, secondAlongPx),
      maximum: Math.max(firstAlongPx, secondAlongPx),
    });
  }

  let chainMinimum = 0;
  let chainMaximum = span.hostLengthPx;
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

  const minimumEndMarginPx = input.options?.minimumEndMarginPx
    ?? DEFAULT_OPENING_ANALYSIS_OPTIONS.minimumEndMarginPx;
  if (
    span.startOutside
      ? chainMinimum > span.openingStartAlongPx - minimumEndMarginPx + EPSILON
      : chainMaximum < span.openingEndAlongPx + minimumEndMarginPx - EPSILON
  ) return null;

  return {
    startExtensionPx: Math.max(0, -chainMinimum),
    endExtensionPx: Math.max(0, chainMaximum - span.hostLengthPx),
  };
}

function retryPlanForRejection(
  rejection: OpeningHypothesisRejection,
  host: RecognitionWallCandidate,
  input: ValidateOpeningHypothesesInput,
): RetryPlan | null {
  const perpendicular = perpendicularExtensionForRejection(rejection, host, input);
  if (perpendicular) {
    return {
      extension: perpendicular,
      validationReason: "perpendicular-far-side-terminated",
    };
  }
  const chain = chainExtensionForRejection(rejection, host, input);
  return chain
    ? {
        extension: chain,
        validationReason: "host-wall-chain-validated",
      }
    : null;
}

function extendedHost(
  host: RecognitionWallCandidate,
  extension: HostExtension,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate | null {
  const start = pixelPoint(host.start, widthPx, heightPx);
  const end = pixelPoint(host.end, widthPx, heightPx);
  const vector = subtract(end, start);
  const lengthPx = vectorLength(vector);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  const extendedStart = add(start, scale(tangent, -extension.startExtensionPx));
  const extendedEnd = add(end, scale(tangent, extension.endExtensionPx));
  return {
    ...host,
    start: {
      x: clamp(extendedStart.x / widthPx, 0, 1),
      y: clamp(extendedStart.y / heightPx, 0, 1),
    },
    end: {
      x: clamp(extendedEnd.x / widthPx, 0, 1),
      y: clamp(extendedEnd.y / heightPx, 0, 1),
    },
  };
}

function markValidated(
  candidate: RecognitionOpeningCandidate,
  validationReason: RetryPlan["validationReason"],
): RecognitionOpeningCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        validationReason,
      ])].sort(),
    },
  };
}

export function retryTerminalDoorHostValidation(
  result: OpeningAnalysisResult,
  input: ValidateOpeningHypothesesInput,
): OpeningAnalysisResult {
  const wallsById = new Map(input.wallCandidates.map((wall) => [wall.id, wall]));
  const extensionsById = new Map<string, HostExtension>();
  const validationReasonByCandidateId = new Map<string, RetryPlan["validationReason"]>();
  const retryCandidates: RecognitionOpeningCandidate[] = [];
  const retryIds = new Set<string>();

  for (const rejection of result.rejections) {
    const hostId = rejection.hostWallCandidateId;
    if (hostId === null) continue;
    const host = wallsById.get(hostId);
    if (!host) continue;
    const plan = retryPlanForRejection(rejection, host, input);
    if (!plan) continue;
    const current = extensionsById.get(hostId) ?? {
      startExtensionPx: 0,
      endExtensionPx: 0,
    };
    extensionsById.set(hostId, {
      startExtensionPx: Math.max(current.startExtensionPx, plan.extension.startExtensionPx),
      endExtensionPx: Math.max(current.endExtensionPx, plan.extension.endExtensionPx),
    });
    validationReasonByCandidateId.set(rejection.candidateId, plan.validationReason);
    retryCandidates.push(rejection.candidate);
    retryIds.add(rejection.candidateId);
  }

  if (retryCandidates.length === 0) return result;
  const validationWalls = input.wallCandidates.map((wall) => {
    const extension = extensionsById.get(wall.id);
    return extension
      ? extendedHost(wall, extension, input.widthPx, input.heightPx) ?? wall
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
    .map((candidate) => {
      const validationReason = validationReasonByCandidateId.get(candidate.id);
      return validationReason ? markValidated(candidate, validationReason) : candidate;
    })
    .sort((first, second) => first.id.localeCompare(second.id));
  const retainedRejections = result.rejections.filter((rejection) => !retryIds.has(rejection.candidateId));
  const rejections = [...retainedRejections, ...retried.rejections]
    .sort((first, second) =>
      first.candidateId.localeCompare(second.candidateId)
      || first.code.localeCompare(second.code));
  return { candidates, rejections };
}
