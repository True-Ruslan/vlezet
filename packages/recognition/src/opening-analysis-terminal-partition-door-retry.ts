import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningHypothesisRejection,
} from "./opening-analysis";
import { validateOpeningHypotheses as validateOpeningHypothesesBase } from "./opening-analysis-runtime-with-window-proposals";

const MIN_HOST_TO_OPENING_RATIO = 0.9;
const MAX_HOST_TO_OPENING_RATIO = 1.75;
const MIN_OPENING_TO_THICKNESS_RATIO = 3.4;
const MAX_OPENING_TO_THICKNESS_RATIO = 4.4;
const HOST_EDGE_ALIGNMENT_TOLERANCE_PX = 6;
const REQUIRED_END_MARGIN_PX = 24;
const EXTENSION_EPSILON_PX = 0.5;
const EPSILON = 1e-7;

type Point = Readonly<{ x: number; y: number }>;
type HostGeometry = Readonly<{
  start: Point;
  end: Point;
  tangent: Point;
  lengthPx: number;
}>;
type OutsideSpan = Readonly<{
  side: "start" | "end";
  geometry: HostGeometry;
}>;

function add(first: Point, second: Point): Point {
  return { x: first.x + second.x, y: first.y + second.y };
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function scale(point: Point, amount: number): Point {
  return { x: point.x * amount, y: point.y * amount };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function exactTerminalPartitionCandidate(candidate: RecognitionOpeningCandidate): boolean {
  const reasons = candidate.evidence.reasons;
  return candidate.kind === "door"
    && reasons.includes("continuous-host-mask-door-gap")
    && reasons.includes("door-leaf-anchored")
    && reasons.includes("perpendicular-door-leaf")
    && reasons.includes("terminal-host-mask-door-gap")
    && !reasons.includes("short-terminal-door-jamb-evidence");
}

function geometry(
  host: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): HostGeometry | null {
  const start = { x: host.start.x * widthPx, y: host.start.y * heightPx };
  const end = { x: host.end.x * widthPx, y: host.end.y * heightPx };
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return null;
  return {
    start,
    end,
    tangent: { x: vector.x / lengthPx, y: vector.y / lengthPx },
    lengthPx,
  };
}

function eligibleRatios(
  candidate: RecognitionOpeningCandidate,
  host: RecognitionWallCandidate,
  hostLengthPx: number,
): boolean {
  const openingWidthPx = candidate.widthPx;
  const thicknessPx = host.estimatedThicknessPx;
  if (
    openingWidthPx === null
    || !Number.isFinite(openingWidthPx)
    || openingWidthPx <= 0
    || thicknessPx === null
    || !Number.isFinite(thicknessPx)
    || thicknessPx <= 0
  ) return false;
  const hostToOpening = hostLengthPx / openingWidthPx;
  const openingToThickness = openingWidthPx / thicknessPx;
  return hostToOpening >= MIN_HOST_TO_OPENING_RATIO
    && hostToOpening <= MAX_HOST_TO_OPENING_RATIO
    && openingToThickness >= MIN_OPENING_TO_THICKNESS_RATIO
    && openingToThickness <= MAX_OPENING_TO_THICKNESS_RATIO;
}

function outsideSpan(
  candidate: RecognitionOpeningCandidate,
  host: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): OutsideSpan | null {
  const openingWidthPx = candidate.widthPx;
  if (openingWidthPx === null || !Number.isFinite(openingWidthPx) || openingWidthPx <= 0) return null;
  const hostGeometry = geometry(host, widthPx, heightPx);
  if (!hostGeometry || !eligibleRatios(candidate, host, hostGeometry.lengthPx)) return null;

  const center = { x: candidate.center.x * widthPx, y: candidate.center.y * heightPx };
  const centerAlongPx = dot(subtract(center, hostGeometry.start), hostGeometry.tangent);
  const halfWidthPx = openingWidthPx / 2;
  const openingStartPx = centerAlongPx - halfWidthPx;
  const openingEndPx = centerAlongPx + halfWidthPx;
  const startsOutside = openingStartPx < -EPSILON;
  const endsOutside = openingEndPx > hostGeometry.lengthPx + EPSILON;
  if (startsOutside === endsOutside) return null;

  if (startsOutside) {
    if (Math.abs(openingEndPx) > HOST_EDGE_ALIGNMENT_TOLERANCE_PX) return null;
    return { side: "start", geometry: hostGeometry };
  }
  if (Math.abs(openingStartPx - hostGeometry.lengthPx) > HOST_EDGE_ALIGNMENT_TOLERANCE_PX) return null;
  return { side: "end", geometry: hostGeometry };
}

function replayedExactly(
  candidate: RecognitionOpeningCandidate,
  input: AnalyzeOpeningHypothesesInput,
): boolean {
  const mask = input.structuralMask;
  const symbolSegments = input.symbolSegments ?? [];
  if (
    !mask
    || mask.widthPx !== input.widthPx
    || mask.heightPx !== input.heightPx
    || symbolSegments.length === 0
  ) return false;
  const replay = detectContinuousHostDoorOpenings({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
    symbolSegments,
    mask,
  });
  return replay.openingHypotheses.some((current) =>
    current.id === candidate.id
    && current.kind === candidate.kind
    && current.hostWallCandidateId === candidate.hostWallCandidateId
    && current.widthPx !== null
    && candidate.widthPx !== null
    && Math.abs(current.widthPx - candidate.widthPx) <= 1
    && Math.hypot(
      (current.center.x - candidate.center.x) * input.widthPx,
      (current.center.y - candidate.center.y) * input.heightPx,
    ) <= 1);
}

function validationHost(
  host: RecognitionWallCandidate,
  span: OutsideSpan,
  openingWidthPx: number,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const extensionPx = openingWidthPx + REQUIRED_END_MARGIN_PX + EXTENSION_EPSILON_PX;
  const start = span.side === "start"
    ? add(span.geometry.start, scale(span.geometry.tangent, -extensionPx))
    : span.geometry.start;
  const end = span.side === "end"
    ? add(span.geometry.end, scale(span.geometry.tangent, extensionPx))
    : span.geometry.end;
  return {
    ...host,
    start: { x: start.x / widthPx, y: start.y / heightPx },
    end: { x: end.x / widthPx, y: end.y / heightPx },
  };
}

function markValidated(candidate: RecognitionOpeningCandidate): RecognitionOpeningCandidate {
  return {
    ...candidate,
    evidence: {
      ...candidate.evidence,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "terminal-partition-stub-validated",
      ])].sort(),
    },
  };
}

export function retryTerminalPartitionDoor(
  input: AnalyzeOpeningHypothesesInput,
  rejection: OpeningHypothesisRejection,
): RecognitionOpeningCandidate | null {
  if (
    rejection.code !== "opening-outside-host-span"
    || !exactTerminalPartitionCandidate(rejection.candidate)
  ) return null;
  const hostId = rejection.hostWallCandidateId ?? rejection.candidate.hostWallCandidateId;
  if (!hostId) return null;
  const host = input.wallCandidates.find((candidate) => candidate.id === hostId && candidate.conflict === null);
  if (!host) return null;
  const span = outsideSpan(rejection.candidate, host, input.widthPx, input.heightPx);
  if (!span || !replayedExactly(rejection.candidate, input)) return null;
  const openingWidthPx = rejection.candidate.widthPx!;
  const temporaryHost = validationHost(
    host,
    span,
    openingWidthPx,
    input.widthPx,
    input.heightPx,
  );
  const retried = validateOpeningHypothesesBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates.map((candidate) =>
      candidate.id === host.id ? temporaryHost : candidate),
    hypotheses: [rejection.candidate],
    options: input.options,
  });
  return retried.candidates.length === 1 ? markValidated(retried.candidates[0]!) : null;
}
