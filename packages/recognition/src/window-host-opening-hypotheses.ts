import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { windowHostProposalEvidenceForWall } from "./window-host-consolidation-runtime";

export type CreateWindowHostOpeningHypothesesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
}>;

type Point = Readonly<{ x: number; y: number }>;

const MAX_WALL_CANDIDATES = 128;
const MIN_END_MARGIN_PX = 24;
const MAX_AXIS_ANGLE_DELTA_DEG = 8;
const MIN_WINDOW_WIDTH_PX = 30;
const MAX_WINDOW_WIDTH_PX = 240;
const EPSILON = 1e-7;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function angleDeltaDeg(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function openingForWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): RecognitionOpeningCandidate | null {
  if (candidate.conflict !== null) return null;
  const evidence = windowHostProposalEvidenceForWall(candidate);
  if (
    !evidence
    || !evidence.openingEligible
    || evidence.bridgeKind !== "symbol"
    || evidence.generatedHost.candidateId !== candidate.id
  ) return null;

  const values = [
    evidence.gap.start.x,
    evidence.gap.start.y,
    evidence.gap.end.x,
    evidence.gap.end.y,
    evidence.gap.center.x,
    evidence.gap.center.y,
    evidence.gap.widthPx,
    evidence.gap.orientationDeg,
  ];
  if (!values.every(Number.isFinite)) return null;
  if (
    evidence.gap.widthPx < MIN_WINDOW_WIDTH_PX
    || evidence.gap.widthPx > MAX_WINDOW_WIDTH_PX
  ) return null;
  if (
    evidence.gap.center.x < 0
    || evidence.gap.center.x > widthPx
    || evidence.gap.center.y < 0
    || evidence.gap.center.y > heightPx
  ) return null;

  const start = {
    x: candidate.start.x * widthPx,
    y: candidate.start.y * heightPx,
  };
  const end = {
    x: candidate.end.x * widthPx,
    y: candidate.end.y * heightPx,
  };
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  const normal = { x: -tangent.y, y: tangent.x };
  const relativeCenter = subtract(evidence.gap.center, start);
  const centerAlong = dot(relativeCenter, tangent);
  const centerAcross = dot(relativeCenter, normal);
  const halfWidth = evidence.gap.widthPx / 2;
  const axisTolerancePx = Math.max(8, (candidate.estimatedThicknessPx ?? 20) / 2 + 4);
  if (Math.abs(centerAcross) > axisTolerancePx) return null;
  if (
    centerAlong - halfWidth < MIN_END_MARGIN_PX
    || lengthPx - centerAlong - halfWidth < MIN_END_MARGIN_PX
  ) return null;

  const hostOrientationDeg = ((Math.atan2(vector.y, vector.x) * 180 / Math.PI) + 180) % 180;
  if (angleDeltaDeg(hostOrientationDeg, evidence.gap.orientationDeg) > MAX_AXIS_ANGLE_DELTA_DEG) return null;

  const normalizedCenter = {
    x: clamp01(evidence.gap.center.x / widthPx),
    y: clamp01(evidence.gap.center.y / heightPx),
  };
  return {
    id: [
      "window-host-proposal",
      candidate.id,
      Math.round(evidence.gap.center.x),
      Math.round(evidence.gap.center.y),
      Math.round(evidence.gap.widthPx),
    ].join("-"),
    kind: "window",
    hostWallCandidateId: candidate.id,
    center: normalizedCenter,
    widthPx: evidence.gap.widthPx,
    orientationDeg: evidence.gap.orientationDeg,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.78, Math.max(candidate.evidence.localScore ?? 0.72, 0.76)),
      cloudScore: null,
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "host-wall-validated",
        "opening-span-validated",
        "paired-window-rails",
        "window-host-proposal-evidence",
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

export function createWindowHostOpeningHypotheses(
  input: CreateWindowHostOpeningHypothesesInput,
): readonly RecognitionOpeningCandidate[] {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.wallCandidates.length > MAX_WALL_CANDIDATES
  ) return [];

  const hypotheses: RecognitionOpeningCandidate[] = [];
  const seen = new Set<string>();
  for (const wall of [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id))) {
    const hypothesis = openingForWall(wall, input.widthPx, input.heightPx);
    if (!hypothesis || seen.has(hypothesis.id)) continue;
    seen.add(hypothesis.id);
    hypotheses.push(hypothesis);
  }
  return hypotheses;
}
