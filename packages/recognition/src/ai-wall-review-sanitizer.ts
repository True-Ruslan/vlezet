import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import type {
  AiLocalWallReviewProposal,
  NormalizedBox,
  SanitizedRecognitionProposal,
} from "./ai-proposals";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { NormalizedPoint, RecognitionDraft, RecognitionWallCandidate } from "./model";
import { validateRecognitionDraft } from "./model";
import { analyzeStructuralClutterCandidate } from "./structural-clutter-veto";
import type { RecognitionAiProviderIdentity } from "./ai-proposal-sanity";

export type SanitizeAiLocalWallReviewProposalInput = Readonly<{
  proposal: AiLocalWallReviewProposal;
  localDraft: RecognitionDraft;
  localEvidence: RecognitionAiLocalEvidenceSnapshot;
  provider: RecognitionAiProviderIdentity;
}>;

const REQUIRED_PROVIDER_PROFILE_REASONS = [
  "weak-structural-mask-support",
  "short-clutter-profile",
] as const;
const PROVIDER_CLUTTER_CLASS_REASONS = [
  "sanitary-symbol-overlap",
  "furniture-symbol-overlap",
] as const;
const LOCAL_CLUTTER_PROFILE_REASON = "structural-clutter-veto";

type Point = Readonly<{ x: number; y: number }>;
type Box = Readonly<{
  minimumX: number;
  minimumY: number;
  maximumX: number;
  maximumY: number;
}>;

function normalizedTargetId(proposal: AiLocalWallReviewProposal): string | null {
  return typeof proposal.targetWallCandidateId === "string" && proposal.targetWallCandidateId.trim()
    ? proposal.targetWallCandidateId.trim()
    : null;
}

function resultBase(
  input: SanitizeAiLocalWallReviewProposalInput,
  fingerprint: string,
  targetLocalCandidateId: string | null,
  validatorReasons: readonly string[],
): SanitizedRecognitionProposal {
  return {
    id: `ai-proposal:${input.provider.requestId}:${input.proposal.id}`,
    rawProposalId: input.proposal.id,
    kind: "local-wall-review",
    state: "blocked",
    geometry: null,
    targetLocalCandidateId,
    hostWallCandidateId: null,
    provider: {
      providerId: input.provider.providerId,
      modelId: input.provider.modelId,
      requestId: input.provider.requestId,
    },
    modelConfidence: input.proposal.modelConfidence,
    deterministicConfidence: "low",
    sourceRegion: input.proposal.sourceRegion,
    evidence: {
      providerReasons: [...input.proposal.reasonCodes],
      validatorReasons: [...validatorReasons],
    },
    localDraftFingerprint: fingerprint,
  };
}

function blocked(
  input: SanitizeAiLocalWallReviewProposalInput,
  fingerprint: string,
  targetLocalCandidateId: string | null,
  reason: string,
): SanitizedRecognitionProposal {
  return resultBase(input, fingerprint, targetLocalCandidateId, [reason]);
}

function eligible(
  input: SanitizeAiLocalWallReviewProposalInput,
  fingerprint: string,
  targetLocalCandidateId: string,
): SanitizedRecognitionProposal {
  return {
    ...resultBase(input, fingerprint, targetLocalCandidateId, [
      "exact-local-wall-target-validated",
      "source-region-overlap-validated",
      "local-clutter-profile-validated",
      "weak-structural-support-validated",
      "single-anchor-or-less-validated",
    ]),
    state: "eligible",
  };
}

function expectedActiveWallIds(draft: RecognitionDraft): string[] {
  return draft.walls
    .filter(({ conflict }) => conflict === null)
    .map(({ id }) => id)
    .sort();
}

function sameOrderedStrings(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function validEvidenceDimensions(evidence: RecognitionAiLocalEvidenceSnapshot): boolean {
  return Number.isInteger(evidence.widthPx)
    && evidence.widthPx > 0
    && Number.isInteger(evidence.heightPx)
    && evidence.heightPx > 0
    && evidence.structuralMask.widthPx === evidence.widthPx
    && evidence.structuralMask.heightPx === evidence.heightPx;
}

function hasCompleteProviderExplanation(proposal: AiLocalWallReviewProposal): boolean {
  return REQUIRED_PROVIDER_PROFILE_REASONS.every((reason) => proposal.reasonCodes.includes(reason))
    && PROVIDER_CLUTTER_CLASS_REASONS.some((reason) => proposal.reasonCodes.includes(reason));
}

function hasExactLocalClutterProfile(
  target: RecognitionWallCandidate,
  evidence: RecognitionAiLocalEvidenceSnapshot,
): boolean {
  if (target.conflict === null) return false;
  const matching = evidence.clutterEvidence.filter(({ wallCandidateId }) => wallCandidateId === target.id);
  if (matching.length !== 1) return false;
  return matching[0]!.reasonCodes.includes(LOCAL_CLUTTER_PROFILE_REASON)
    && target.evidence.reasons.includes(LOCAL_CLUTTER_PROFILE_REASON);
}

function point(point: NormalizedPoint): Point {
  return { x: point.x, y: point.y };
}

function expandedSourceBox(
  region: NormalizedBox,
  wall: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): Box {
  const halfThicknessPx = Math.max(3, (wall.estimatedThicknessPx ?? 20) / 2);
  const xMargin = halfThicknessPx / widthPx;
  const yMargin = halfThicknessPx / heightPx;
  return {
    minimumX: Math.max(0, region.x - xMargin),
    minimumY: Math.max(0, region.y - yMargin),
    maximumX: Math.min(1, region.x + region.width + xMargin),
    maximumY: Math.min(1, region.y + region.height + yMargin),
  };
}

function pointInsideBox(value: Point, box: Box): boolean {
  return value.x >= box.minimumX
    && value.x <= box.maximumX
    && value.y >= box.minimumY
    && value.y <= box.maximumY;
}

function segmentIntersectsBox(start: Point, end: Point, box: Box): boolean {
  if (pointInsideBox(start, box) || pointInsideBox(end, box)) return true;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = [-dx, dx, -dy, dy];
  const q = [
    start.x - box.minimumX,
    box.maximumX - start.x,
    start.y - box.minimumY,
    box.maximumY - start.y,
  ];
  let minimumT = 0;
  let maximumT = 1;

  for (let index = 0; index < p.length; index += 1) {
    const denominator = p[index]!;
    const numerator = q[index]!;
    if (Math.abs(denominator) <= Number.EPSILON) {
      if (numerator < 0) return false;
      continue;
    }
    const ratio = numerator / denominator;
    if (denominator < 0) minimumT = Math.max(minimumT, ratio);
    else maximumT = Math.min(maximumT, ratio);
    if (minimumT > maximumT) return false;
  }
  return true;
}

function sourceRegionOverlapsTarget(
  proposal: AiLocalWallReviewProposal,
  target: RecognitionWallCandidate,
  evidence: RecognitionAiLocalEvidenceSnapshot,
): boolean {
  return segmentIntersectsBox(
    point(target.start),
    point(target.end),
    expandedSourceBox(proposal.sourceRegion, target, evidence.widthPx, evidence.heightPx),
  );
}

export function sanitizeAiLocalWallReviewProposal(
  input: SanitizeAiLocalWallReviewProposalInput,
): SanitizedRecognitionProposal {
  const draft = validateRecognitionDraft(input.localDraft);
  const fingerprint = createLocalDraftFingerprint(draft);
  const targetId = normalizedTargetId(input.proposal);

  if (input.proposal.recommendation !== "likely-clutter") {
    return blocked(input, fingerprint, targetId, "unsupported-wall-review-recommendation");
  }
  if (!targetId) return blocked(input, fingerprint, null, "unknown-local-wall-target");

  const target = draft.walls.find(({ id }) => id === targetId);
  if (!target) return blocked(input, fingerprint, targetId, "unknown-local-wall-target");

  if (input.localEvidence.localDraftFingerprint !== fingerprint) {
    return blocked(input, fingerprint, targetId, "stale-local-evidence-fingerprint");
  }
  if (!validEvidenceDimensions(input.localEvidence)) {
    return blocked(input, fingerprint, targetId, "invalid-local-evidence-dimensions");
  }
  if (!sameOrderedStrings(
    [...input.localEvidence.activeWallIds].sort(),
    expectedActiveWallIds(draft),
  )) {
    return blocked(input, fingerprint, targetId, "stale-active-wall-identity");
  }
  if (!hasExactLocalClutterProfile(target, input.localEvidence)) {
    return blocked(input, fingerprint, targetId, "target-outside-local-clutter-profile");
  }
  if (!sourceRegionOverlapsTarget(input.proposal, target, input.localEvidence)) {
    return blocked(input, fingerprint, targetId, "source-region-does-not-overlap-target");
  }
  if (!hasCompleteProviderExplanation(input.proposal)) {
    return blocked(input, fingerprint, targetId, "provider-wall-review-evidence-incomplete");
  }

  const analysis = analyzeStructuralClutterCandidate({
    widthPx: input.localEvidence.widthPx,
    heightPx: input.localEvidence.heightPx,
    wallCandidates: draft.walls,
    targetWallCandidateId: targetId,
    mask: input.localEvidence.structuralMask,
  });
  if (!analysis) {
    return blocked(input, fingerprint, targetId, "wall-review-analysis-unavailable");
  }
  if (!analysis.isShortWall) {
    return blocked(input, fingerprint, targetId, "protected-long-structural-wall");
  }
  if (!analysis.hasWeakStructuralSupport) {
    return blocked(input, fingerprint, targetId, "protected-strong-structural-mask");
  }
  if (analysis.hasTwoEndpointAnchors) {
    return blocked(input, fingerprint, targetId, "protected-two-anchor-wall");
  }

  return eligible(input, fingerprint, targetId);
}
