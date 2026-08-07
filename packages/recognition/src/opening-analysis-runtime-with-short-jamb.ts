import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningAnalysisResult,
  OpeningHypothesisRejection,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
import { deduplicateOpeningCandidatesAcrossHosts } from "./opening-cross-host-dedup";
import { retryRemoteTerminalDoor } from "./opening-analysis-remote-terminal-door-retry";
import { retryTerminalPartitionDoor } from "./opening-analysis-terminal-partition-door-retry";
import {
  analyzeOpeningHypotheses as analyzeOpeningHypothesesBase,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis-runtime-with-window-proposals";
import type { StructuralMaskView } from "./wall-completion";

const REQUIRED_MARGIN_PX = 24;
const MIN_JAMB_LENGTH_PX = 18;
const MAX_JAMB_LENGTH_PX = 47;
const MIN_JAMB_PAIR_SEPARATION_PX = 3;
const MAX_JAMB_PAIR_SEPARATION_PX = 12;
const MAX_ENDPOINT_DISTANCE_PX = 12;
const MIN_STRUCTURAL_SUPPORT = 0.75;
const MAX_ANGLE_DELTA_DEG = 8;
const EPSILON = 1e-7;

type Point = Readonly<{ x: number; y: number }>;
type RetryInput = AnalyzeOpeningHypothesesInput;
type ShortJamb = Readonly<{
  start: Point;
  end: Point;
  length: number;
  angleDeg: number;
  midpoint: Point;
}>;

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

function angle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const vector = subtract(end, start);
  const lengthSquared = dot(vector, vector);
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, dot(subtract(point, start), vector) / lengthSquared));
  const closest = add(start, scale(vector, ratio));
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function lineSupport(mask: StructuralMaskView, start: Point, end: Point, samples = 13): number {
  let supported = 0;
  for (let index = 0; index < samples; index += 1) {
    const ratio = (index + 0.5) / samples;
    const point = add(start, scale(subtract(end, start), ratio));
    if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) supported += 1;
  }
  return supported / samples;
}

function exactShortJambProposal(candidate: RecognitionOpeningCandidate): boolean {
  return candidate.kind === "window"
    && candidate.evidence.reasons.includes("paired-window-rails")
    && candidate.evidence.reasons.includes("window-host-proposal-evidence")
    && candidate.evidence.reasons.includes("short-terminal-jamb-evidence");
}

function hostPixels(
  host: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): Readonly<{ start: Point; end: Point; tangent: Point; length: number; angleDeg: number }> | null {
  const start = { x: host.start.x * widthPx, y: host.start.y * heightPx };
  const end = { x: host.end.x * widthPx, y: host.end.y * heightPx };
  const vector = subtract(end, start);
  const length = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(length) || length <= EPSILON) return null;
  return {
    start,
    end,
    tangent: { x: vector.x / length, y: vector.y / length },
    length,
    angleDeg: angle(start, end),
  };
}

function deficiency(
  candidate: RecognitionOpeningCandidate,
  host: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): Readonly<{
  side: "start" | "end";
  endpoint: Point;
  extensionPx: number;
  geometry: NonNullable<ReturnType<typeof hostPixels>>;
}> | null {
  if (candidate.widthPx === null || candidate.widthPx <= 0) return null;
  const geometry = hostPixels(host, widthPx, heightPx);
  if (!geometry) return null;
  const center = { x: candidate.center.x * widthPx, y: candidate.center.y * heightPx };
  const centerAlong = dot(subtract(center, geometry.start), geometry.tangent);
  const halfWidth = candidate.widthPx / 2;
  const startMargin = centerAlong - halfWidth;
  const endMargin = geometry.length - centerAlong - halfWidth;
  const startDeficient = startMargin < REQUIRED_MARGIN_PX;
  const endDeficient = endMargin < REQUIRED_MARGIN_PX;
  if (startDeficient === endDeficient) return null;
  if (startMargin < -EPSILON || endMargin < -EPSILON) return null;
  return startDeficient
    ? {
        side: "start",
        endpoint: geometry.start,
        extensionPx: REQUIRED_MARGIN_PX - startMargin + 0.5,
        geometry,
      }
    : {
        side: "end",
        endpoint: geometry.end,
        extensionPx: REQUIRED_MARGIN_PX - endMargin + 0.5,
        geometry,
      };
}

function shortJambs(
  segments: readonly DetectedLineSegment[],
  mask: StructuralMaskView,
  hostAngleDeg: number,
  endpoint: Point,
): ShortJamb[] {
  return segments.flatMap((segment): ShortJamb[] => {
    const start = { x: segment.x1, y: segment.y1 };
    const end = { x: segment.x2, y: segment.y2 };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < MIN_JAMB_LENGTH_PX || length > MAX_JAMB_LENGTH_PX) return [];
    const angleDeg = angle(start, end);
    if (angleDelta(hostAngleDeg, angleDeg) < 70) return [];
    if (pointSegmentDistance(endpoint, start, end) > MAX_ENDPOINT_DISTANCE_PX) return [];
    if (lineSupport(mask, start, end) < MIN_STRUCTURAL_SUPPORT) return [];
    return [{ start, end, length, angleDeg, midpoint: scale(add(start, end), 0.5) }];
  }).sort((first, second) =>
    first.midpoint.x - second.midpoint.x
    || first.midpoint.y - second.midpoint.y
    || first.length - second.length);
}

function hasPairedShortJamb(
  input: RetryInput,
  hostAngleDeg: number,
  endpoint: Point,
): boolean {
  const segments = input.symbolSegments ?? [];
  const mask = input.structuralMask;
  if (!mask || mask.widthPx !== input.widthPx || mask.heightPx !== input.heightPx) return false;
  const jambs = shortJambs(segments, mask, hostAngleDeg, endpoint);
  for (let firstIndex = 0; firstIndex < jambs.length; firstIndex += 1) {
    const first = jambs[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < jambs.length; secondIndex += 1) {
      const second = jambs[secondIndex]!;
      if (angleDelta(first.angleDeg, second.angleDeg) > MAX_ANGLE_DELTA_DEG) continue;
      const separation = Math.hypot(
        first.midpoint.x - second.midpoint.x,
        first.midpoint.y - second.midpoint.y,
      );
      if (separation < MIN_JAMB_PAIR_SEPARATION_PX || separation > MAX_JAMB_PAIR_SEPARATION_PX) continue;
      const lengthRatio = Math.min(first.length, second.length) / Math.max(first.length, second.length);
      if (lengthRatio < 0.7) continue;
      return true;
    }
  }
  return false;
}

function extendedHost(
  host: RecognitionWallCandidate,
  gap: NonNullable<ReturnType<typeof deficiency>>,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const start = gap.side === "start"
    ? add(gap.geometry.start, scale(gap.geometry.tangent, -gap.extensionPx))
    : gap.geometry.start;
  const end = gap.side === "end"
    ? add(gap.geometry.end, scale(gap.geometry.tangent, gap.extensionPx))
    : gap.geometry.end;
  return {
    ...host,
    start: { x: start.x / widthPx, y: start.y / heightPx },
    end: { x: end.x / widthPx, y: end.y / heightPx },
  };
}

function markShortJamb(candidate: RecognitionOpeningCandidate): RecognitionOpeningCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([...candidate.evidence.reasons, "short-structural-jamb-terminated"])].sort(),
    },
  };
}

function retryShortJamb(
  input: RetryInput,
  rejection: OpeningHypothesisRejection,
): RecognitionOpeningCandidate | null {
  if (rejection.code !== "opening-end-margin" || !exactShortJambProposal(rejection.candidate)) return null;
  const hostId = rejection.candidate.hostWallCandidateId;
  if (!hostId) return null;
  const host = input.wallCandidates.find(({ id, conflict }) => id === hostId && conflict === null);
  if (!host) return null;
  const gap = deficiency(rejection.candidate, host, input.widthPx, input.heightPx);
  if (!gap || !hasPairedShortJamb(input, gap.geometry.angleDeg, gap.endpoint)) return null;
  const temporary = extendedHost(host, gap, input.widthPx, input.heightPx);
  const wallCandidates = input.wallCandidates.map((candidate) => candidate.id === host.id ? temporary : candidate);
  const retried = validateOpeningHypothesesBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates,
    hypotheses: [rejection.candidate],
    options: input.options,
  });
  return retried.candidates.length === 1 ? markShortJamb(retried.candidates[0]!) : null;
}

export function analyzeOpeningHypotheses(input: AnalyzeOpeningHypothesesInput): OpeningAnalysisResult {
  const base = analyzeOpeningHypothesesBase(input);
  if (!input.structuralMask || !input.symbolSegments?.length || base.rejections.length === 0) return base;
  const recovered = new Map<string, RecognitionOpeningCandidate>();
  for (const rejection of base.rejections) {
    const candidate = retryShortJamb(input, rejection)
      ?? retryRemoteTerminalDoor(input, rejection)
      ?? retryTerminalPartitionDoor(input, rejection);
    if (candidate) recovered.set(rejection.candidateId, candidate);
  }
  if (recovered.size === 0) return base;
  const merged = {
    candidates: [...base.candidates, ...recovered.values()].sort((first, second) => first.id.localeCompare(second.id)),
    rejections: base.rejections.filter(({ candidateId }) => !recovered.has(candidateId)),
  };
  return deduplicateOpeningCandidatesAcrossHosts(
    merged,
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  );
}

export function validateOpeningHypotheses(input: ValidateOpeningHypothesesInput): OpeningAnalysisResult {
  return validateOpeningHypothesesBase(input);
}
