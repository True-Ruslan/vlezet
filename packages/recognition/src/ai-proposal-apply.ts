import { createLocalDraftFingerprint } from "./draft-fingerprint";
import {
  validateRecognitionDraft,
  type RecognitionDraft,
  type RecognitionOpeningCandidate,
  type RecognitionWallCandidate,
  type ValidatedRecognitionDraft,
} from "./model";
import type { SanitizedRecognitionProposal } from "./ai-proposals";

export type RecognitionAtomicApplyReferencePlan = Readonly<{
  assetId: string;
  referenceRevision: string;
  widthPx: number;
  heightPx: number;
}>;

export type RecognitionAtomicApplyDocument = Readonly<{
  walls: readonly unknown[];
  openings: readonly unknown[];
}>;

export type RecognitionAtomicApplyDiagnostic = Readonly<{
  candidateId: string;
  severity: "info" | "warning" | "error";
  message: string;
}>;

export type RecognitionAtomicApplyPreflight = Readonly<{
  applicableDraft: RecognitionDraft;
  acceptedProposalIds: readonly string[];
  diagnostics: readonly RecognitionAtomicApplyDiagnostic[];
}>;

export type PrepareAtomicRecognitionApplyInput = Readonly<{
  draft: RecognitionDraft;
  referencePlan: RecognitionAtomicApplyReferencePlan;
  document: RecognitionAtomicApplyDocument;
}>;

function error(candidateId: string, message: string): RecognitionAtomicApplyDiagnostic {
  return { candidateId, severity: "error", message };
}

function acceptedProposalIds(draft: ValidatedRecognitionDraft): string[] {
  return Object.entries(draft.proposalDecisions)
    .filter(([, decision]) => decision === "accepted")
    .map(([proposalId]) => proposalId)
    .sort();
}

function hostPixelScale(
  wall: RecognitionWallCandidate,
  referencePlan: RecognitionAtomicApplyReferencePlan,
): number | null {
  const normalizedDx = wall.end.x - wall.start.x;
  const normalizedDy = wall.end.y - wall.start.y;
  const normalizedLength = Math.hypot(normalizedDx, normalizedDy);
  const pixelLength = Math.hypot(
    normalizedDx * referencePlan.widthPx,
    normalizedDy * referencePlan.heightPx,
  );
  if (!Number.isFinite(normalizedLength) || normalizedLength <= Number.EPSILON) return null;
  if (!Number.isFinite(pixelLength) || pixelLength <= Number.EPSILON) return null;
  return pixelLength / normalizedLength;
}

function materializedOpening(
  proposal: SanitizedRecognitionProposal,
  host: RecognitionWallCandidate,
  referencePlan: RecognitionAtomicApplyReferencePlan,
): RecognitionOpeningCandidate | RecognitionAtomicApplyDiagnostic {
  if (proposal.kind === "local-wall-review" || proposal.geometry?.kind !== "opening") {
    return error(proposal.id, "Принятое AI-предложение не содержит проверенную геометрию проёма.");
  }
  const scale = hostPixelScale(host, referencePlan);
  const widthPx = scale === null ? Number.NaN : proposal.geometry.widthNormalized * scale;
  if (!Number.isFinite(widthPx) || widthPx <= 0) {
    return error(proposal.id, "Не удалось безопасно пересчитать ширину AI-проёма по стене-хозяину.");
  }
  return {
    id: proposal.id,
    kind: proposal.kind,
    hostWallCandidateId: host.id,
    center: proposal.geometry.center,
    widthPx,
    orientationDeg: proposal.geometry.orientationDeg,
    confidence: proposal.deterministicConfidence,
    evidence: {
      localScore: proposal.deterministicConfidence === "medium" ? 0.7 : 0.45,
      cloudScore: proposal.modelConfidence,
      reasons: [...new Set([
        "ai-proposal-accepted",
        ...proposal.evidence.providerReasons,
        ...proposal.evidence.validatorReasons,
      ])].sort(),
    },
    origin: "merged",
    conflict: null,
  };
}

function failed(
  draft: ValidatedRecognitionDraft,
  diagnostics: readonly RecognitionAtomicApplyDiagnostic[],
): RecognitionAtomicApplyPreflight {
  return {
    applicableDraft: draft,
    acceptedProposalIds: [],
    diagnostics,
  };
}

export function prepareAtomicRecognitionApply(
  input: PrepareAtomicRecognitionApplyInput,
): RecognitionAtomicApplyPreflight {
  const draft = validateRecognitionDraft(input.draft);
  void input.document;

  if (
    draft.referenceAssetId !== input.referencePlan.assetId
    || draft.referenceRevision !== input.referencePlan.referenceRevision
  ) {
    return failed(draft, [error(
      draft.id,
      "Черновик распознавания относится к другой или устаревшей подложке.",
    )]);
  }
  if (
    !Number.isInteger(input.referencePlan.widthPx)
    || input.referencePlan.widthPx <= 0
    || !Number.isInteger(input.referencePlan.heightPx)
    || input.referencePlan.heightPx <= 0
  ) {
    return failed(draft, [error(draft.id, "Размеры подложки заданы некорректно.")]);
  }

  const acceptedIds = acceptedProposalIds(draft);
  if (acceptedIds.length === 0) {
    return { applicableDraft: draft, acceptedProposalIds: [], diagnostics: [] };
  }

  const proposalsById = new Map(draft.aiProposals.map((proposal) => [proposal.id, proposal]));
  const currentFingerprint = createLocalDraftFingerprint(draft);
  const metadata = draft.aiProposalMetadata;
  const diagnostics: RecognitionAtomicApplyDiagnostic[] = [];
  const materialized: RecognitionOpeningCandidate[] = [];
  const materializedIds: string[] = [];
  const localCandidateIds = new Set([
    ...draft.walls.map(({ id }) => id),
    ...draft.openings.map(({ id }) => id),
    ...draft.roomLabels.map(({ id }) => id),
  ]);

  for (const proposalId of acceptedIds) {
    const proposal = proposalsById.get(proposalId);
    if (!proposal) {
      diagnostics.push(error(proposalId, "Принятое AI-предложение отсутствует в текущем черновике."));
      continue;
    }
    if (proposal.state !== "eligible") {
      diagnostics.push(error(proposal.id, "AI-предложение не допущено детерминированными проверками."));
      continue;
    }
    if (
      !metadata
      || metadata.referenceRevision !== draft.referenceRevision
      || metadata.localDraftFingerprint !== currentFingerprint
      || proposal.localDraftFingerprint !== currentFingerprint
    ) {
      diagnostics.push(error(
        proposal.id,
        "AI-предложение устарело: fingerprint локального черновика изменился.",
      ));
      continue;
    }
    if (proposal.kind === "local-wall-review") {
      continue;
    }
    if (localCandidateIds.has(proposal.id)) {
      diagnostics.push(error(proposal.id, "Идентификатор AI-предложения конфликтует с локальным кандидатом."));
      continue;
    }
    const hostId = proposal.hostWallCandidateId;
    const host = hostId ? draft.walls.find(({ id }) => id === hostId) : undefined;
    const hostDecision = hostId ? draft.decisions[hostId] : undefined;
    if (
      !host
      || host.conflict !== null
      || (hostDecision !== "accepted" && hostDecision !== "edited")
    ) {
      diagnostics.push(error(
        proposal.id,
        "Зависимое AI-предложение нельзя применить: стена-хозяин отсутствует или не принята.",
      ));
      continue;
    }
    const opening = materializedOpening(proposal, host, input.referencePlan);
    if ("severity" in opening) {
      diagnostics.push(opening);
      continue;
    }
    materialized.push(opening);
    materializedIds.push(proposal.id);
  }

  if (diagnostics.some(({ severity }) => severity === "error")) {
    return failed(draft, diagnostics);
  }

  const applicableDraft = validateRecognitionDraft({
    ...draft,
    openings: [...draft.openings, ...materialized],
    decisions: {
      ...draft.decisions,
      ...Object.fromEntries(materializedIds.map((id) => [id, "accepted"] as const)),
    },
  });
  return {
    applicableDraft,
    acceptedProposalIds: materializedIds,
    diagnostics,
  };
}
