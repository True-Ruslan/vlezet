import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import {
  DEFAULT_OPENING_ANALYSIS_OPTIONS,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningHypothesisRejection,
} from "./opening-analysis";

const EPSILON = 1e-7;
const MAX_WALLS = 128;
const MAX_SEGMENTS = 512;
const MAX_CENTER_DELTA_PX = 0.75;
const MAX_WIDTH_DELTA_PX = 0.75;
const MAX_ANGLE_DELTA_DEG = 0.25;
const MIN_ENTRANCE_WIDTH_TO_THICKNESS_RATIO = 2.75;
const MAX_ENTRANCE_WIDTH_TO_THICKNESS_RATIO = 4.75;

function reasonsAreExact(rejection: OpeningHypothesisRejection): boolean {
  const reasons = rejection.candidate.evidence.reasons;
  return rejection.code === "opening-outside-host-span"
    && rejection.candidate.kind === "door"
    && rejection.hostWallCandidateId !== null
    && reasons.includes("continuous-host-mask-door-gap")
    && reasons.includes("door-leaf-anchored")
    && reasons.includes("exterior-terminal-door-leaf")
    && reasons.includes("perpendicular-door-leaf")
    && reasons.includes("terminal-host-mask-continuation");
}

function strongHost(host: RecognitionWallCandidate): boolean {
  const reasons = host.evidence.reasons;
  return host.conflict === null
    && reasons.includes("topology-edge")
    && reasons.includes("paired-parallel-edges")
    && reasons.includes("primary-structural-component");
}

function entranceScaleAllowed(
  candidate: RecognitionOpeningCandidate,
  host: RecognitionWallCandidate,
): boolean {
  const widthPx = candidate.widthPx;
  const thicknessPx = host.estimatedThicknessPx;
  if (
    widthPx === null
    || !Number.isFinite(widthPx)
    || widthPx <= 0
    || thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
  ) return false;
  const ratio = widthPx / thicknessPx;
  return ratio >= MIN_ENTRANCE_WIDTH_TO_THICKNESS_RATIO
    && ratio <= MAX_ENTRANCE_WIDTH_TO_THICKNESS_RATIO;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function replayMatches(
  expected: RecognitionOpeningCandidate,
  replay: RecognitionOpeningCandidate,
  input: AnalyzeOpeningHypothesesInput,
): boolean {
  if (
    replay.id !== expected.id
    || replay.kind !== expected.kind
    || replay.hostWallCandidateId !== expected.hostWallCandidateId
    || replay.widthPx === null
    || expected.widthPx === null
    || replay.orientationDeg === null
    || expected.orientationDeg === null
  ) return false;
  const centerDeltaPx = Math.hypot(
    (replay.center.x - expected.center.x) * input.widthPx,
    (replay.center.y - expected.center.y) * input.heightPx,
  );
  return centerDeltaPx <= MAX_CENTER_DELTA_PX
    && Math.abs(replay.widthPx - expected.widthPx) <= MAX_WIDTH_DELTA_PX
    && angleDelta(replay.orientationDeg, expected.orientationDeg) <= MAX_ANGLE_DELTA_DEG;
}

function validationHost(
  candidate: RecognitionOpeningCandidate,
  host: RecognitionWallCandidate,
  input: AnalyzeOpeningHypothesesInput,
): RecognitionWallCandidate | null {
  const start = { x: host.start.x * input.widthPx, y: host.start.y * input.heightPx };
  const end = { x: host.end.x * input.widthPx, y: host.end.y * input.heightPx };
  const vector = { x: end.x - start.x, y: end.y - start.y };
  const hostLengthPx = Math.hypot(vector.x, vector.y);
  const widthPx = candidate.widthPx;
  const thicknessPx = host.estimatedThicknessPx;
  if (
    hostLengthPx <= EPSILON
    || widthPx === null
    || !Number.isFinite(widthPx)
    || widthPx <= 0
    || thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
  ) return null;
  const tangent = { x: vector.x / hostLengthPx, y: vector.y / hostLengthPx };
  const center = { x: candidate.center.x * input.widthPx, y: candidate.center.y * input.heightPx };
  const centerAlongPx = (center.x - start.x) * tangent.x + (center.y - start.y) * tangent.y;
  const openingStartPx = centerAlongPx - widthPx / 2;
  const openingEndPx = centerAlongPx + widthPx / 2;
  const afterEnd = openingStartPx >= hostLengthPx - EPSILON;
  const beforeStart = openingEndPx <= EPSILON;
  if (afterEnd === beforeStart) return null;
  const terminalGapPx = afterEnd ? openingStartPx - hostLengthPx : -openingEndPx;
  if (terminalGapPx > thicknessPx + 2 + EPSILON) return null;

  const marginPx = input.options?.minimumEndMarginPx
    ?? DEFAULT_OPENING_ANALYSIS_OPTIONS.minimumEndMarginPx;
  const startExtensionPx = beforeStart ? -openingStartPx + marginPx + 0.5 : 0;
  const endExtensionPx = afterEnd ? openingEndPx + marginPx + 0.5 - hostLengthPx : 0;
  const extendedStart = {
    x: start.x - tangent.x * startExtensionPx,
    y: start.y - tangent.y * startExtensionPx,
  };
  const extendedEnd = {
    x: end.x + tangent.x * endExtensionPx,
    y: end.y + tangent.y * endExtensionPx,
  };
  if (
    Math.min(extendedStart.x, extendedStart.y, extendedEnd.x, extendedEnd.y) < -EPSILON
    || extendedStart.x > input.widthPx + EPSILON
    || extendedEnd.x > input.widthPx + EPSILON
    || extendedStart.y > input.heightPx + EPSILON
    || extendedEnd.y > input.heightPx + EPSILON
  ) return null;
  return {
    ...host,
    start: { x: extendedStart.x / input.widthPx, y: extendedStart.y / input.heightPx },
    end: { x: extendedEnd.x / input.widthPx, y: extendedEnd.y / input.heightPx },
  };
}

function validated(candidate: RecognitionOpeningCandidate): RecognitionOpeningCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([...candidate.evidence.reasons, "exterior-terminal-door-validated"])].sort(),
    },
  };
}

export function retryExteriorTerminalDoor(
  input: AnalyzeOpeningHypothesesInput,
  rejection: OpeningHypothesisRejection,
): RecognitionOpeningCandidate | null {
  const mask = input.structuralMask;
  const segments = input.symbolSegments;
  if (
    !reasonsAreExact(rejection)
    || !mask
    || mask.widthPx !== input.widthPx
    || mask.heightPx !== input.heightPx
    || !segments?.length
    || segments.length > MAX_SEGMENTS
    || input.wallCandidates.length > MAX_WALLS
  ) return null;
  const host = input.wallCandidates.find(({ id }) => id === rejection.hostWallCandidateId);
  if (!host || !strongHost(host) || !entranceScaleAllowed(rejection.candidate, host)) return null;

  const replayed = detectContinuousHostDoorOpenings({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    symbolSegments: segments,
    mask,
  }).openingHypotheses.filter((candidate) => replayMatches(rejection.candidate, candidate, input));
  if (replayed.length !== 1 || !entranceScaleAllowed(replayed[0]!, host)) return null;

  const temporaryHost = validationHost(replayed[0]!, host, input);
  if (!temporaryHost) return null;
  const retried = validateOpeningHypothesesBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates.map((candidate) => candidate.id === host.id ? temporaryHost : candidate),
    hypotheses: [replayed[0]!],
    options: input.options,
  });
  return retried.candidates.length === 1 && retried.rejections.length === 0
    ? validated(retried.candidates[0]!)
    : null;
}
