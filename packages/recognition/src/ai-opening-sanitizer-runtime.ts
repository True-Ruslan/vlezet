import type { RecognitionAiRejectedOpeningEvidence } from "./ai-rejected-opening-evidence";
import { peekAiRejectedOpeningEvidenceForDraft } from "./ai-rejected-opening-evidence";
import {
  sanitizeAiOpeningProposal as sanitizeAiOpeningProposalBase,
  type SanitizeAiOpeningProposalInput,
  type SanitizedAiOpeningProposal,
} from "./ai-opening-sanitizer";
import { DEFAULT_OPENING_ANALYSIS_OPTIONS } from "./opening-analysis";

const FORBIDDEN_LOCAL_EVIDENCE = [
  "sanitary",
  "furniture",
  "dimension",
  "text",
  "label",
  "fixture",
] as const;
const MATCH_CENTER_TOLERANCE_PX = 28;

function blockedWithReason(
  result: SanitizedAiOpeningProposal,
  reason: string,
): SanitizedAiOpeningProposal {
  return {
    ...result,
    state: "blocked",
    geometry: null,
    deterministicConfidence: "low",
    evidence: {
      ...result.evidence,
      validatorReasons: [reason],
    },
  };
}

function activeHost(input: SanitizeAiOpeningProposalInput) {
  if (input.proposal.hostWallHintIds.length !== 1) return null;
  const hostId = input.proposal.hostWallHintIds[0]!;
  return input.localDraft.walls.find(({ id, conflict }) => id === hostId && conflict === null) ?? null;
}

function hostPixelScale(
  input: SanitizeAiOpeningProposalInput,
): number | null {
  const host = activeHost(input);
  if (!host) return null;
  const normalizedLength = Math.hypot(
    host.end.x - host.start.x,
    host.end.y - host.start.y,
  );
  const pixelLength = Math.hypot(
    (host.end.x - host.start.x) * input.localEvidence.widthPx,
    (host.end.y - host.start.y) * input.localEvidence.heightPx,
  );
  if (!Number.isFinite(normalizedLength) || normalizedLength <= 0 || pixelLength <= 0) return null;
  return pixelLength / normalizedLength;
}

function invalidWidth(input: SanitizeAiOpeningProposalInput): boolean {
  const scale = hostPixelScale(input);
  if (scale === null) return false;
  const widthPx = input.proposal.widthNormalized * scale;
  return !Number.isFinite(widthPx)
    || widthPx < DEFAULT_OPENING_ANALYSIS_OPTIONS.minimumOpeningWidthPx
    || widthPx > DEFAULT_OPENING_ANALYSIS_OPTIONS.maximumOpeningWidthPx;
}

function forbiddenEvidence(item: RecognitionAiRejectedOpeningEvidence): boolean {
  return item.reasonCodes.some((reason) => {
    const canonical = reason.toLowerCase();
    return FORBIDDEN_LOCAL_EVIDENCE.some((token) => canonical.includes(token));
  });
}

function matchingForbiddenEvidence(input: SanitizeAiOpeningProposalInput): boolean {
  const host = activeHost(input);
  const evidence = peekAiRejectedOpeningEvidenceForDraft(input.localDraft);
  if (!host || !evidence) return false;
  const centerX = input.proposal.center.x * input.localEvidence.widthPx;
  const centerY = input.proposal.center.y * input.localEvidence.heightPx;
  return evidence.items.some((item) => {
    if (
      item.hostWallCandidateId !== host.id
      || (item.kind !== "door" && item.kind !== "unknown-opening")
      || !forbiddenEvidence(item)
    ) return false;
    const itemX = item.center.x * input.localEvidence.widthPx;
    const itemY = item.center.y * input.localEvidence.heightPx;
    return Math.hypot(itemX - centerX, itemY - centerY) <= MATCH_CENTER_TOLERANCE_PX;
  });
}

export function sanitizeAiOpeningProposal(
  input: SanitizeAiOpeningProposalInput,
): SanitizedAiOpeningProposal {
  const result = sanitizeAiOpeningProposalBase(input);
  if (result.state === "eligible") return result;
  if (invalidWidth(input)) return blockedWithReason(result, "invalid-opening-width");
  if (matchingForbiddenEvidence(input)) {
    return blockedWithReason(result, "forbidden-local-clutter-evidence");
  }
  return result;
}
