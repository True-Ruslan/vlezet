import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import {
  windowHostProposalEvidenceForWall,
  type WindowHostProposalEvidence,
} from "./window-host-consolidation-runtime";

export type CreateWindowHostOpeningHypothesesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  proposalEvidence?: readonly WindowHostProposalEvidence[];
}>;

type Point = Readonly<{ x: number; y: number }>;

const MAX_WALL_CANDIDATES = 128;
const MAX_PROPOSAL_EVIDENCE = 32;
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

function openingForEvidence(
  evidence: WindowHostProposalEvidence,
  widthPx: number,
  heightPx: number,
  currentHost: RecognitionWallCandidate | null,
): RecognitionOpeningCandidate | null {
  if (
    !evidence.openingEligible
    || evidence.bridgeKind !== "symbol"
    || (currentHost !== null && (
      currentHost.conflict !== null
      || evidence.generatedHost.candidateId !== currentHost.id
    ))
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
    evidence.generatedHost.start.x,
    evidence.generatedHost.start.y,
    evidence.generatedHost.end.x,
    evidence.generatedHost.end.y,
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

  const start = currentHost === null
    ? evidence.generatedHost.start
    : {
        x: currentHost.start.x * widthPx,
        y: currentHost.start.y * heightPx,
      };
  const end = currentHost === null
    ? evidence.generatedHost.end
    : {
        x: currentHost.end.x * widthPx,
        y: currentHost.end.y * heightPx,
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
  const axisTolerancePx = currentHost === null
    ? 8
    : Math.max(8, (currentHost.estimatedThicknessPx ?? 20) / 2 + 4);
  if (Math.abs(centerAcross) > axisTolerancePx) return null;

  const startMarginPx = centerAlong - halfWidth;
  const endMarginPx = lengthPx - centerAlong - halfWidth;
  if (currentHost === null) {
    if (startMarginPx < -EPSILON || endMarginPx < -EPSILON) return null;
  } else if (
    startMarginPx < MIN_END_MARGIN_PX
    || endMarginPx < MIN_END_MARGIN_PX
  ) return null;

  const hostOrientationDeg = ((Math.atan2(vector.y, vector.x) * 180 / Math.PI) + 180) % 180;
  if (angleDeltaDeg(hostOrientationDeg, evidence.gap.orientationDeg) > MAX_AXIS_ANGLE_DELTA_DEG) return null;

  const candidateId = evidence.generatedHost.candidateId;
  const baseReasons = currentHost?.evidence.reasons ?? [];
  return {
    id: [
      "window-host-proposal",
      candidateId,
      Math.round(evidence.gap.center.x),
      Math.round(evidence.gap.center.y),
      Math.round(evidence.gap.widthPx),
    ].join("-"),
    kind: "window",
    hostWallCandidateId: candidateId,
    center: {
      x: clamp01(evidence.gap.center.x / widthPx),
      y: clamp01(evidence.gap.center.y / heightPx),
    },
    widthPx: evidence.gap.widthPx,
    orientationDeg: evidence.gap.orientationDeg,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.78, Math.max(currentHost?.evidence.localScore ?? 0.72, 0.76)),
      cloudScore: null,
      reasons: [...new Set([
        ...baseReasons,
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
  const proposalEvidence = input.proposalEvidence ?? [];
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.wallCandidates.length > MAX_WALL_CANDIDATES
    || proposalEvidence.length > MAX_PROPOSAL_EVIDENCE
  ) return [];

  const hypotheses: RecognitionOpeningCandidate[] = [];
  const seen = new Set<string>();
  const append = (hypothesis: RecognitionOpeningCandidate | null): void => {
    if (!hypothesis || seen.has(hypothesis.id)) return;
    seen.add(hypothesis.id);
    hypotheses.push(hypothesis);
  };

  for (const evidence of [...proposalEvidence].sort((first, second) =>
    first.generatedHost.candidateId.localeCompare(second.generatedHost.candidateId)
    || first.gap.center.x - second.gap.center.x
    || first.gap.center.y - second.gap.center.y)) {
    append(openingForEvidence(evidence, input.widthPx, input.heightPx, null));
  }
  for (const wall of [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id))) {
    const evidence = windowHostProposalEvidenceForWall(wall);
    if (!evidence) continue;
    append(openingForEvidence(evidence, input.widthPx, input.heightPx, wall));
  }
  return hypotheses.sort((first, second) => first.id.localeCompare(second.id));
}
