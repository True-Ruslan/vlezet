import {
  emptyAiProposalDraftState,
  validateAiProposalDraftState,
  validateRecognitionAiProposalMetadata,
  validateSanitizedRecognitionProposal,
  type RecognitionAiProposalMetadata,
  type RecognitionProposalDecisionMap,
  type SanitizedRecognitionProposal,
} from "./ai-proposals";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import {
  validateRecognitionDraft,
  type RecognitionDiagnostic,
  type RecognitionDraft,
  type ValidatedRecognitionDraft,
} from "./model";

export type ReconcileAiProposalBatchInput = Readonly<{
  localDraft: RecognitionDraft;
  sanitized: readonly SanitizedRecognitionProposal[];
  metadata: RecognitionAiProposalMetadata;
  now: string;
}>;

const RECONCILIATION_REJECTED_CODE = "ai-proposal-reconciliation-rejected";
const PROPOSAL_STATE_INVALIDATED_CODE = "ai-proposal-state-invalidated";

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalProposals(
  proposals: readonly SanitizedRecognitionProposal[],
): SanitizedRecognitionProposal[] {
  return proposals
    .map(validateSanitizedRecognitionProposal)
    .sort((left, right) => lexicalCompare(left.id, right.id));
}

function proposalDecisionsFor(
  proposals: readonly SanitizedRecognitionProposal[],
): RecognitionProposalDecisionMap {
  return Object.fromEntries(
    proposals
      .filter(({ state }) => state === "eligible")
      .map(({ id }) => [id, "pending"] as const),
  );
}

function hasProposalState(draft: ValidatedRecognitionDraft): boolean {
  return draft.aiProposals.length > 0
    || Object.keys(draft.proposalDecisions).length > 0
    || draft.aiProposalMetadata !== null;
}

function proposalStateMatchesCurrentDraft(
  draft: ValidatedRecognitionDraft,
  fingerprint: string,
): boolean {
  if (!hasProposalState(draft)) return true;
  const metadata = draft.aiProposalMetadata;
  if (!metadata) return false;
  return metadata.referenceRevision === draft.referenceRevision
    && metadata.localDraftFingerprint === fingerprint
    && draft.aiProposals.every((proposal) =>
      proposal.localDraftFingerprint === fingerprint
      && proposal.provider.requestId === metadata.requestId
      && proposal.provider.providerId === metadata.providerId
      && proposal.provider.modelId === metadata.modelId);
}

function localCandidateIds(draft: ValidatedRecognitionDraft): ReadonlySet<string> {
  return new Set([
    ...draft.walls.map(({ id }) => id),
    ...draft.openings.map(({ id }) => id),
    ...draft.roomLabels.map(({ id }) => id),
  ]);
}

function hasLocalDecisionNamespaceCollision(
  draft: ValidatedRecognitionDraft,
  proposals: readonly SanitizedRecognitionProposal[],
): boolean {
  const localIds = localCandidateIds(draft);
  return proposals.some(({ id }) => localIds.has(id));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function appendBoundedDiagnostic(
  diagnostics: readonly RecognitionDiagnostic[],
  diagnostic: RecognitionDiagnostic,
): RecognitionDiagnostic[] {
  const withoutPrevious = diagnostics.filter(({ code, candidateId }) =>
    code !== diagnostic.code || candidateId !== diagnostic.candidateId);
  return [...withoutPrevious, diagnostic];
}

function withDiagnostic(
  draft: ValidatedRecognitionDraft,
  diagnostic: RecognitionDiagnostic,
  now: string,
): ValidatedRecognitionDraft {
  const diagnostics = appendBoundedDiagnostic(draft.diagnostics, diagnostic);
  if (sameJson(diagnostics, draft.diagnostics)) return draft;
  return validateRecognitionDraft({
    ...draft,
    diagnostics,
    updatedAt: now,
  });
}

function invalidateStaleProposalState(
  draft: ValidatedRecognitionDraft,
  now: string,
): ValidatedRecognitionDraft {
  if (!hasProposalState(draft)) return draft;
  return validateRecognitionDraft({
    ...draft,
    ...emptyAiProposalDraftState(),
    diagnostics: appendBoundedDiagnostic(draft.diagnostics, {
      code: PROPOSAL_STATE_INVALIDATED_CODE,
      severity: "warning",
      message: "AI-предложения сброшены, потому что локальная геометрия или ревизия подложки изменились.",
      candidateId: null,
    }),
    updatedAt: now,
  });
}

function rejected(
  draft: ValidatedRecognitionDraft,
  now: string,
): ValidatedRecognitionDraft {
  return withDiagnostic(draft, {
    code: RECONCILIATION_REJECTED_CODE,
    severity: "warning",
    message: "Пакет AI-предложений не согласован с текущим локальным черновиком и не заменил последнее корректное состояние.",
    candidateId: null,
  }, now);
}

export function reconcileAiProposalBatch(
  input: ReconcileAiProposalBatchInput,
): ValidatedRecognitionDraft {
  const localDraft = validateRecognitionDraft(input.localDraft);
  const currentFingerprint = createLocalDraftFingerprint(localDraft);
  const currentStateIsValid = proposalStateMatchesCurrentDraft(
    localDraft,
    currentFingerprint,
  );
  const fallbackDraft = currentStateIsValid
    ? localDraft
    : invalidateStaleProposalState(localDraft, input.now);

  try {
    const proposals = canonicalProposals(input.sanitized);
    const metadata = validateRecognitionAiProposalMetadata(input.metadata);
    if (!metadata) return rejected(fallbackDraft, input.now);
    if (
      metadata.referenceRevision !== localDraft.referenceRevision
      || metadata.localDraftFingerprint !== currentFingerprint
    ) {
      return rejected(fallbackDraft, input.now);
    }
    if (hasLocalDecisionNamespaceCollision(localDraft, proposals)) {
      return rejected(fallbackDraft, input.now);
    }

    validateAiProposalDraftState({
      aiProposals: proposals,
      proposalDecisions: proposalDecisionsFor(proposals),
      aiProposalMetadata: metadata,
    });

    if (
      currentStateIsValid
      && sameJson(localDraft.aiProposals, proposals)
      && sameJson(localDraft.aiProposalMetadata, metadata)
    ) {
      return localDraft;
    }

    return validateRecognitionDraft({
      ...localDraft,
      aiProposals: proposals,
      proposalDecisions: proposalDecisionsFor(proposals),
      aiProposalMetadata: metadata,
      updatedAt: input.now,
    });
  } catch {
    return rejected(fallbackDraft, input.now);
  }
}
