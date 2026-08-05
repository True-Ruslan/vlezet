import type { AiRecognitionProposal, SanitizedRecognitionProposal } from "./ai-proposals";
import { sanitizeAiOpeningProposal } from "./ai-opening-sanitizer-runtime";
import {
  sanitizeAiProposalBatch as sanitizeAiProposalBatchBase,
  type SanitizeAiProposalBatchInput,
  type SanitizeAiProposalBatchResult,
} from "./ai-proposal-sanity";
import { sanitizeAiLocalWallReviewProposal } from "./ai-wall-review-sanitizer";

function isWholeBatchRejection(result: SanitizeAiProposalBatchResult): boolean {
  return result.sanitized.length === 0
    && result.diagnostics.some(({ code, severity }) =>
      code === "ai-proposal-batch-rejected" && severity === "error");
}

function rawProposalById(
  input: SanitizeAiProposalBatchInput,
): ReadonlyMap<string, AiRecognitionProposal> {
  return new Map(input.batch.proposals.map((proposal) => [proposal.id, proposal]));
}

export function sanitizeAiProposalBatch(
  input: SanitizeAiProposalBatchInput,
): SanitizeAiProposalBatchResult {
  const preliminary = sanitizeAiProposalBatchBase(input);
  if (isWholeBatchRejection(preliminary)) return preliminary;

  const rawById = rawProposalById(input);
  const sanitized: SanitizedRecognitionProposal[] = [];
  for (const candidate of preliminary.sanitized) {
    const raw = rawById.get(candidate.rawProposalId);
    if (raw?.kind === "opening-addition") {
      sanitized.push(sanitizeAiOpeningProposal({
        proposal: raw,
        localDraft: input.localDraft,
        localEvidence: input.localEvidence,
        provider: input.provider,
        acceptedSiblingProposals: sanitized,
      }));
      continue;
    }
    if (raw?.kind === "local-wall-review") {
      sanitized.push(sanitizeAiLocalWallReviewProposal({
        proposal: raw,
        localDraft: input.localDraft,
        localEvidence: input.localEvidence,
        provider: input.provider,
      }));
      continue;
    }
    sanitized.push(candidate);
  }

  return {
    sanitized,
    diagnostics: preliminary.diagnostics,
  };
}
