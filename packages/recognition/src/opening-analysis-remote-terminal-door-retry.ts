import type { DetectedLineSegment } from "./local-lines";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningHypothesisRejection,
} from "./opening-analysis";
import { validateOpeningHypotheses as validateOpeningHypothesesBase } from "./opening-analysis-runtime-with-window-proposals";
import type { StructuralMaskView } from "./wall-completion";

type Point = Readonly<{ x: number; y: number }>;
type HostGeometry = Readonly<{
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  halfThicknessPx: number;
}>;
type RemoteDoorSpan = Readonly<{
  side: "start" | "end";
  remoteAlongPx: number;
  terminalAlongPx: number;
  geometry: HostGeometry;
}>;

const REQUIRED_MARGIN_PX = 24;
const HOST_EDGE_ALIGNMENT_TOLERANCE_PX = 6;
const LEAF_ANCHOR_TOLERANCE_PX = 16;
const MIN_LEAF_WALL_ANGLE_DEG = 65;
const MAX_LEAF_ALONG_DRIFT_RATIO = 0.28;
const MAX_LEAF_STRUCTURAL_SUPPORT_RATIO = 0.4;
const MAX_GAP_SUPPORT_RATIO = 0.28;
const MIN_BOUNDARY_SUPPORT_RATIO = 0.5;
const MIN_DOOR_WIDTH_PX = 30;
const MAX_DOOR_WIDTH_PX = 240;
const BOUNDARY_PROBE_MIN_PX = 10;
const BOUNDARY_PROBE_MAX_PX = 18;
const EPSILON = 1e-7;

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

function angle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pointOnHost(geometry: HostGeometry, alongPx: number, acrossPx = 0): Point {
  return add(
    geometry.start,
    add(scale(geometry.tangent, alongPx), scale(geometry.normal, acrossPx)),
  );
}

function hostGeometry(
  host: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): HostGeometry | null {
  const start = { x: host.start.x * widthPx, y: host.start.y * heightPx };
  const end = { x: host.end.x * widthPx, y: host.end.y * heightPx };
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  return {
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: angle(start, end),
    halfThicknessPx: Math.max(2, Math.min(80, (host.estimatedThicknessPx ?? 20) / 2)),
  };
}

function exactRemoteTerminalDoor(candidate: RecognitionOpeningCandidate): boolean {
  const reasons = candidate.evidence.reasons;
  return candidate.kind === "door"
    && reasons.includes("continuous-host-mask-door-gap")
    && reasons.includes("door-leaf-anchored")
    && reasons.includes("perpendicular-door-leaf")
    && reasons.includes("short-terminal-door-jamb-evidence")
    && reasons.includes("terminal-host-mask-door-gap");
}

function remoteDoorSpan(
  candidate: RecognitionOpeningCandidate,
  host: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): RemoteDoorSpan | null {
  const openingWidthPx = candidate.widthPx;
  if (
    openingWidthPx === null
    || !Number.isFinite(openingWidthPx)
    || openingWidthPx < MIN_DOOR_WIDTH_PX
    || openingWidthPx > MAX_DOOR_WIDTH_PX
  ) return null;
  const geometry = hostGeometry(host, widthPx, heightPx);
  if (!geometry) return null;
  const center = { x: candidate.center.x * widthPx, y: candidate.center.y * heightPx };
  const relativeCenter = subtract(center, geometry.start);
  const centerAlongPx = dot(relativeCenter, geometry.tangent);
  const centerAcrossPx = dot(relativeCenter, geometry.normal);
  if (Math.abs(centerAcrossPx) > geometry.halfThicknessPx + 6) return null;

  const openingStartPx = centerAlongPx - openingWidthPx / 2;
  const openingEndPx = centerAlongPx + openingWidthPx / 2;
  const startsOutside = openingStartPx < -EPSILON;
  const endsOutside = openingEndPx > geometry.lengthPx + EPSILON;
  if (startsOutside === endsOutside) return null;

  if (startsOutside) {
    if (Math.abs(openingEndPx) > HOST_EDGE_ALIGNMENT_TOLERANCE_PX) return null;
    return {
      side: "start",
      remoteAlongPx: openingStartPx,
      terminalAlongPx: 0,
      geometry,
    };
  }
  if (Math.abs(openingStartPx - geometry.lengthPx) > HOST_EDGE_ALIGNMENT_TOLERANCE_PX) return null;
  return {
    side: "end",
    remoteAlongPx: openingEndPx,
    terminalAlongPx: geometry.lengthPx,
    geometry,
  };
}

function maskMatches(input: AnalyzeOpeningHypothesesInput): input is AnalyzeOpeningHypothesesInput & Readonly<{
  structuralMask: StructuralMaskView;
}> {
  return input.structuralMask !== undefined
    && input.structuralMask.widthPx === input.widthPx
    && input.structuralMask.heightPx === input.heightPx;
}

function crossSectionSupport(
  geometry: HostGeometry,
  alongPx: number,
  mask: StructuralMaskView,
): number {
  const samples = 9;
  const halfSpanPx = Math.max(2, geometry.halfThicknessPx * 0.82);
  let structural = 0;
  for (let index = 0; index < samples; index += 1) {
    const acrossPx = -halfSpanPx + halfSpanPx * 2 * (index + 0.5) / samples;
    const point = pointOnHost(geometry, alongPx, acrossPx);
    if (mask.isStructural(Math.floor(point.x), Math.floor(point.y))) structural += 1;
  }
  return structural / samples;
}

function averageHostSupport(
  geometry: HostGeometry,
  startAlongPx: number,
  endAlongPx: number,
  mask: StructuralMaskView,
): number {
  const minimum = Math.min(startAlongPx, endAlongPx);
  const maximum = Math.max(startAlongPx, endAlongPx);
  if (maximum - minimum <= EPSILON) return 1;
  const samples = Math.max(3, Math.min(48, Math.ceil((maximum - minimum) / 3)));
  let support = 0;
  for (let index = 0; index < samples; index += 1) {
    const alongPx = minimum + (maximum - minimum) * (index + 0.5) / samples;
    support += crossSectionSupport(geometry, alongPx, mask);
  }
  return support / samples;
}

function lineSupport(
  segment: DetectedLineSegment,
  mask: StructuralMaskView,
  samples = 24,
): number {
  let structural = 0;
  for (let index = 0; index < samples; index += 1) {
    const ratio = (index + 0.5) / samples;
    const x = segment.x1 + (segment.x2 - segment.x1) * ratio;
    const y = segment.y1 + (segment.y2 - segment.y1) * ratio;
    if (mask.isStructural(Math.floor(x), Math.floor(y))) structural += 1;
  }
  return structural / samples;
}

function hasMatchingLeaf(
  candidate: RecognitionOpeningCandidate,
  span: RemoteDoorSpan,
  segments: readonly DetectedLineSegment[],
  mask: StructuralMaskView,
): boolean {
  const openingWidthPx = candidate.widthPx!;
  const remotePoint = pointOnHost(span.geometry, span.remoteAlongPx);
  return segments.some((segment) => {
    const start = { x: segment.x1, y: segment.y1 };
    const end = { x: segment.x2, y: segment.y2 };
    const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
    if (
      !Number.isFinite(lengthPx)
      || lengthPx < openingWidthPx * 0.45
      || lengthPx > openingWidthPx * 1.65
      || angleDelta(angle(start, end), span.geometry.angleDeg) < MIN_LEAF_WALL_ANGLE_DEG
      || lineSupport(segment, mask) > MAX_LEAF_STRUCTURAL_SUPPORT_RATIO
    ) return false;

    const projected = [start, end].map((point) => {
      const relative = subtract(point, span.geometry.start);
      return {
        point,
        along: dot(relative, span.geometry.tangent),
        across: dot(relative, span.geometry.normal),
      };
    });
    for (const [anchor, free] of [[projected[0]!, projected[1]!], [projected[1]!, projected[0]!]] as const) {
      const anchorDistancePx = Math.hypot(anchor.point.x - remotePoint.x, anchor.point.y - remotePoint.y);
      if (anchorDistancePx > LEAF_ANCHOR_TOLERANCE_PX) continue;
      if (Math.abs(anchor.across) > span.geometry.halfThicknessPx + 6) continue;
      if (Math.abs(free.across) < Math.max(18, openingWidthPx * 0.55)) continue;
      if (Math.abs(free.along - anchor.along) > Math.max(12, openingWidthPx * MAX_LEAF_ALONG_DRIFT_RATIO)) continue;
      return true;
    }
    return false;
  });
}

function hasSafeRemoteEvidence(
  candidate: RecognitionOpeningCandidate,
  span: RemoteDoorSpan,
  input: AnalyzeOpeningHypothesesInput & Readonly<{ structuralMask: StructuralMaskView }>,
): boolean {
  const mask = input.structuralMask;
  const direction = span.side === "start" ? -1 : 1;
  const gapWidthPx = Math.abs(span.terminalAlongPx - span.remoteAlongPx);
  const insetPx = Math.min(4, gapWidthPx * 0.12);
  const gapStartPx = Math.min(span.remoteAlongPx, span.terminalAlongPx) + insetPx;
  const gapEndPx = Math.max(span.remoteAlongPx, span.terminalAlongPx) - insetPx;
  if (averageHostSupport(span.geometry, gapStartPx, gapEndPx, mask) > MAX_GAP_SUPPORT_RATIO) return false;

  const probePx = Math.min(
    BOUNDARY_PROBE_MAX_PX,
    Math.max(BOUNDARY_PROBE_MIN_PX, gapWidthPx * 0.2),
  );
  const hostProbeStartPx = span.terminalAlongPx - direction * probePx;
  const hostProbeEndPx = span.terminalAlongPx - direction * 3;
  if (averageHostSupport(span.geometry, hostProbeStartPx, hostProbeEndPx, mask) < MIN_BOUNDARY_SUPPORT_RATIO) {
    return false;
  }
  const remoteProbeStartPx = span.remoteAlongPx + direction * 3;
  const remoteProbeEndPx = span.remoteAlongPx + direction * probePx;
  if (averageHostSupport(span.geometry, remoteProbeStartPx, remoteProbeEndPx, mask) < MIN_BOUNDARY_SUPPORT_RATIO) {
    return false;
  }
  return hasMatchingLeaf(candidate, span, input.symbolSegments ?? [], mask);
}

function validationHost(
  host: RecognitionWallCandidate,
  span: RemoteDoorSpan,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const openingWidthPx = Math.abs(span.terminalAlongPx - span.remoteAlongPx);
  const extensionPx = openingWidthPx + REQUIRED_MARGIN_PX + 0.5;
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
        "short-terminal-door-jamb-validated",
      ])].sort(),
    },
  };
}

export function retryRemoteTerminalDoor(
  input: AnalyzeOpeningHypothesesInput,
  rejection: OpeningHypothesisRejection,
): RecognitionOpeningCandidate | null {
  if (
    rejection.code !== "opening-outside-host-span"
    || !exactRemoteTerminalDoor(rejection.candidate)
    || !maskMatches(input)
    || !input.symbolSegments?.length
  ) return null;
  const hostId = rejection.hostWallCandidateId ?? rejection.candidate.hostWallCandidateId;
  if (!hostId) return null;
  const host = input.wallCandidates.find((candidate) => candidate.id === hostId && candidate.conflict === null);
  if (!host) return null;
  const span = remoteDoorSpan(rejection.candidate, host, input.widthPx, input.heightPx);
  if (!span || !hasSafeRemoteEvidence(rejection.candidate, span, input)) return null;

  const temporaryHost = validationHost(host, span, input.widthPx, input.heightPx);
  const wallCandidates = input.wallCandidates.map((candidate) =>
    candidate.id === host.id ? temporaryHost : candidate);
  const retried = validateOpeningHypothesesBase({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates,
    hypotheses: [rejection.candidate],
    options: input.options,
  });
  return retried.candidates.length === 1 ? markValidated(retried.candidates[0]!) : null;
}
