import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import {
  DEFAULT_OPENING_ANALYSIS_OPTIONS,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningHypothesisRejection,
} from "./opening-analysis";
import { detectPairedBoundaryDoorGaps } from "./paired-boundary-door-gap";

const MAX_WALLS = 128;
const MAX_SEGMENTS = 512;
const MAX_REPLAY_CANDIDATES = 8;
const MAX_CENTER_DELTA_PX = 0.75;
const MAX_WIDTH_DELTA_PX = 0.75;
const MAX_ANGLE_DELTA_DEG = 0.25;
const EPSILON = 1e-7;

type Point = Readonly<{ x: number; y: number }>;

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

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function exactProvenance(rejection: OpeningHypothesisRejection): boolean {
  const reasons = rejection.candidate.evidence.reasons;
  return rejection.code === "opening-outside-host-span"
    && rejection.candidate.kind === "door"
    && rejection.hostWallCandidateId !== null
    && reasons.includes("paired-boundary-door-gap")
    && reasons.includes("paired-boundary-rails")
    && reasons.includes("perpendicular-structural-anchor")
    && reasons.includes("terminal-host-mask-door-gap");
}

function strongHost(host: RecognitionWallCandidate): boolean {
  const reasons = host.evidence.reasons;
  return host.conflict === null
    && reasons.includes("topology-edge")
    && reasons.includes("paired-parallel-edges")
    && reasons.includes("primary-structural-component");
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
  const vector = subtract(end, start);
  const hostLengthPx = Math.hypot(vector.x, vector.y);
  const widthPx = candidate.widthPx;
  const thicknessPx = host.estimatedThicknessPx;
  if (
    !Number.isFinite(hostLengthPx)
    || hostLengthPx <= EPSILON
    || widthPx === null
    || !Number.isFinite(widthPx)
    || widthPx <= 0
    || thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
  ) return null;

  const tangent = { x: vector.x / hostLengthPx, y: vector.y / hostLengthPx };
  const center = { x: candidate.center.x * input.widthPx, y: candidate.center.y * input.heightPx };
  const centerAlongPx = dot(subtract(center, start), tangent);
  const openingStartPx = centerAlongPx - widthPx / 2;
  const openingEndPx = centerAlongPx + widthPx / 2;
  const terminalTolerancePx = Math.max(12, thicknessPx * 0.6);
  const afterEnd = openingEndPx > hostLengthPx + EPSILON
    && Math.abs(openingStartPx - hostLengthPx) <= terminalTolerancePx;
  const beforeStart = openingStartPx < -EPSILON
    && Math.abs(openingEndPx) <= terminalTolerancePx;
  if (afterEnd === beforeStart) return null;

  const marginPx = input.options?.minimumEndMarginPx
    ?? DEFAULT_OPENING_ANALYSIS_OPTIONS.minimumEndMarginPx;
  const startExtensionPx = beforeStart ? -openingStartPx + marginPx + 0.5 : 0;
  const endExtensionPx = afterEnd ? openingEndPx + marginPx + 0.5 - hostLengthPx : 0;
  const extendedStart = add(start, scale(tangent, -startExtensionPx));
  const extendedEnd = add(end, scale(tangent, endExtensionPx));
  if (
    extendedStart.x < -EPSILON
    || extendedStart.y < -EPSILON
    || extendedEnd.x < -EPSILON
    || extendedEnd.y < -EPSILON
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

function markValidated(candidate: RecognitionOpeningCandidate): RecognitionOpeningCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "paired-boundary-door-validated",
      ])].sort(),
    },
  };
}

export function retryPairedBoundaryDoor(
  input: AnalyzeOpeningHypothesesInput,
  rejection: OpeningHypothesisRejection,
): RecognitionOpeningCandidate | null {
  const mask = input.structuralMask;
  const segments = input.symbolSegments;
  if (
    !exactProvenance(rejection)
    || !mask
    || mask.widthPx !== input.widthPx
    || mask.heightPx !== input.heightPx
    || !segments?.length
    || segments.length > MAX_SEGMENTS
    || input.wallCandidates.length > MAX_WALLS
  ) return null;

  const host = input.wallCandidates.find(({ id }) => id === rejection.hostWallCandidateId);
  if (!host || !strongHost(host)) return null;

  const replayed = detectPairedBoundaryDoorGaps({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    symbolSegments: segments,
    mask,
  });
  if (replayed.length > MAX_REPLAY_CANDIDATES) return null;
  const exact = replayed.filter((candidate) => replayMatches(rejection.candidate, candidate, input));
  if (exact.length !== 1) return null;

  const temporaryHost = validationHost(exact[0]!, host, input);
  if (!temporaryHost) return null;
  const retried = validateOpeningHypothesesBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates.map((candidate) =>
      candidate.id === host.id ? temporaryHost : candidate),
    hypotheses: [exact[0]!],
    options: input.options,
  });
  return retried.candidates.length === 1 && retried.rejections.length === 0
    ? markValidated(retried.candidates[0]!)
    : null;
}
