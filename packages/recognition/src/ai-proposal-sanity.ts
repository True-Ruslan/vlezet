import {
  AI_OPENING_REASON_CODES,
  AI_PROPOSAL_MAX_DIAGNOSTICS,
  AI_PROPOSAL_MAX_OPENINGS,
  AI_PROPOSAL_MAX_WALL_REVIEWS,
  AI_PROPOSAL_SCHEMA_VERSION,
  AI_WALL_REVIEW_REASON_CODES,
  AiProposalValidationError,
  type AiLocalWallReviewProposal,
  type AiOpeningAdditionProposal,
  type AiProposalBatch,
  type AiProviderDiagnostic,
  type AiRecognitionProposal,
  type NormalizedBox,
  type SanitizedRecognitionProposal,
} from "./ai-proposals";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import {
  createLocalDraftFingerprint,
  type AiProposalRequestIdentity,
} from "./draft-fingerprint";
import {
  validateRecognitionDraft,
  type RecognitionDiagnostic,
  type RecognitionDraft,
} from "./model";

const MAX_ID_LENGTH = 160;
const MAX_REFERENCE_REVISION_LENGTH = 240;
const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 1_000;
const MAX_HOST_HINTS = 8;
const MAX_REASON_CODES = 8;
const FINGERPRINT_PATTERN = /^recognition-local-draft-v1:[a-f0-9]{64}$/;

export type RecognitionAiProviderIdentity = Readonly<{
  providerId: string;
  modelId: string;
  requestId: string;
}>;

export type SanitizeAiProposalBatchInput = Readonly<{
  batch: AiProposalBatch;
  expectedIdentity: AiProposalRequestIdentity;
  provider: RecognitionAiProviderIdentity;
  localDraft: RecognitionDraft;
  localEvidence: RecognitionAiLocalEvidenceSnapshot;
}>;

export type SanitizeAiProposalBatchResult = Readonly<{
  sanitized: readonly SanitizedRecognitionProposal[];
  diagnostics: readonly RecognitionDiagnostic[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiProposalValidationError(`${label} содержит некорректные данные.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new AiProposalValidationError(`${label} должен быть списком.`);
  }
  return value;
}

function text(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new AiProposalValidationError(`${label} должен быть строкой.`);
  }
  const result = value.trim();
  if (!result || result.length > maximumLength) {
    throw new AiProposalValidationError(`${label} должен быть непустой строкой допустимой длины.`);
  }
  return result;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AiProposalValidationError(`${label} должен быть конечным числом.`);
  }
  return value;
}

function bounded(value: unknown, minimum: number, maximum: number, label: string): number {
  const result = finite(value, label);
  if (result < minimum || result > maximum) {
    throw new AiProposalValidationError(`${label} выходит за допустимый диапазон.`);
  }
  return result;
}

function normalizedBox(value: unknown, label: string): NormalizedBox {
  const input = record(value, label);
  const x = bounded(input.x, 0, 1, `${label}.x`);
  const y = bounded(input.y, 0, 1, `${label}.y`);
  const width = bounded(input.width, Number.EPSILON, 1, `${label}.width`);
  const height = bounded(input.height, Number.EPSILON, 1, `${label}.height`);
  if (x + width > 1 + Number.EPSILON || y + height > 1 + Number.EPSILON) {
    throw new AiProposalValidationError(`${label} выходит за границы нормализованного изображения.`);
  }
  return { x, y, width, height };
}

function normalizedPoint(value: unknown, label: string): Readonly<{ x: number; y: number }> {
  const input = record(value, label);
  return {
    x: bounded(input.x, 0, 1, `${label}.x`),
    y: bounded(input.y, 0, 1, `${label}.y`),
  };
}

function uniqueTextList(
  value: unknown,
  label: string,
  maximumItems: number,
  allowList?: readonly string[],
): string[] {
  const values = array(value, label);
  if (values.length > maximumItems) {
    throw new AiProposalValidationError(`${label} превышает безопасный лимит ${maximumItems}.`);
  }
  const result = values.map((entry, index) => text(entry, `${label}[${index}]`, MAX_ID_LENGTH));
  if (new Set(result).size !== result.length) {
    throw new AiProposalValidationError(`${label} содержит повторяющиеся значения.`);
  }
  if (allowList && result.some((entry) => !allowList.includes(entry))) {
    throw new AiProposalValidationError(`${label} содержит неподдерживаемый код.`);
  }
  return result;
}

function openingProposal(value: unknown, index: number): AiOpeningAdditionProposal {
  const label = `AI-предложение проёма ${index + 1}`;
  const input = record(value, label);
  if (input.kind !== "opening-addition") {
    throw new AiProposalValidationError(`${label}.kind содержит неподдерживаемое значение.`);
  }
  if (input.openingKind !== "door" && input.openingKind !== "window") {
    throw new AiProposalValidationError(`${label}.openingKind содержит неподдерживаемое значение.`);
  }
  const orientationDeg = bounded(input.orientationDeg, 0, 180, `${label}.orientationDeg`);
  if (orientationDeg >= 180) {
    throw new AiProposalValidationError(`${label}.orientationDeg должен быть меньше 180.`);
  }
  const widthNormalized = bounded(input.widthNormalized, Number.EPSILON, 1, `${label}.widthNormalized`);
  return {
    id: text(input.id, `${label}.id`, MAX_ID_LENGTH),
    kind: "opening-addition",
    openingKind: input.openingKind,
    center: normalizedPoint(input.center, `${label}.center`),
    widthNormalized,
    orientationDeg,
    hostWallHintIds: uniqueTextList(input.hostWallHintIds, `${label}.hostWallHintIds`, MAX_HOST_HINTS),
    sourceRegion: normalizedBox(input.sourceRegion, `${label}.sourceRegion`),
    modelConfidence: bounded(input.modelConfidence, 0, 1, `${label}.modelConfidence`),
    reasonCodes: uniqueTextList(
      input.reasonCodes,
      `${label}.reasonCodes`,
      MAX_REASON_CODES,
      AI_OPENING_REASON_CODES,
    ) as AiOpeningAdditionProposal["reasonCodes"],
  };
}

function wallReviewProposal(value: unknown, index: number): AiLocalWallReviewProposal {
  const label = `AI-рекомендация по стене ${index + 1}`;
  const input = record(value, label);
  if (input.kind !== "local-wall-review" || input.recommendation !== "likely-clutter") {
    throw new AiProposalValidationError(`${label} содержит неподдерживаемый тип.`);
  }
  return {
    id: text(input.id, `${label}.id`, MAX_ID_LENGTH),
    kind: "local-wall-review",
    targetWallCandidateId: text(input.targetWallCandidateId, `${label}.targetWallCandidateId`, MAX_ID_LENGTH),
    recommendation: "likely-clutter",
    sourceRegion: normalizedBox(input.sourceRegion, `${label}.sourceRegion`),
    modelConfidence: bounded(input.modelConfidence, 0, 1, `${label}.modelConfidence`),
    reasonCodes: uniqueTextList(
      input.reasonCodes,
      `${label}.reasonCodes`,
      MAX_REASON_CODES,
      AI_WALL_REVIEW_REASON_CODES,
    ) as AiLocalWallReviewProposal["reasonCodes"],
  };
}

function proposal(value: unknown, index: number): AiRecognitionProposal {
  const input = record(value, `AI-предложение ${index + 1}`);
  if (input.kind === "opening-addition") return openingProposal(input, index);
  if (input.kind === "local-wall-review") return wallReviewProposal(input, index);
  throw new AiProposalValidationError(`AI-предложение ${index + 1} содержит неподдерживаемый тип.`);
}

function providerDiagnostic(value: unknown, index: number): AiProviderDiagnostic {
  const label = `Диагностика AI-провайдера ${index + 1}`;
  const input = record(value, label);
  if (input.severity !== "info" && input.severity !== "warning" && input.severity !== "error") {
    throw new AiProposalValidationError(`${label}.severity содержит неподдерживаемое значение.`);
  }
  return {
    code: text(input.code, `${label}.code`, MAX_ID_LENGTH),
    severity: input.severity,
    message: text(input.message, `${label}.message`, MAX_DIAGNOSTIC_MESSAGE_LENGTH),
  };
}

function validateBatchStructure(value: unknown): AiProposalBatch {
  const input = record(value, "Пакет AI-предложений");
  if (input.schemaVersion !== AI_PROPOSAL_SCHEMA_VERSION) {
    throw new AiProposalValidationError("Пакет AI-предложений использует неподдерживаемую версию схемы.");
  }
  const requestId = text(input.requestId, "Пакет AI-предложений.requestId", MAX_ID_LENGTH);
  const referenceRevision = text(
    input.referenceRevision,
    "Пакет AI-предложений.referenceRevision",
    MAX_REFERENCE_REVISION_LENGTH,
  );
  const localDraftFingerprint = text(
    input.localDraftFingerprint,
    "Пакет AI-предложений.localDraftFingerprint",
    96,
  );
  if (!FINGERPRINT_PATTERN.test(localDraftFingerprint)) {
    throw new AiProposalValidationError("Пакет AI-предложений содержит некорректный fingerprint.");
  }

  const rawProposals = array(input.proposals, "AI-предложения");
  const proposals = rawProposals.map(proposal);
  const ids = proposals.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new AiProposalValidationError("Идентификаторы AI-предложений содержат повторяющиеся значения.");
  }
  const openingCount = proposals.filter(({ kind }) => kind === "opening-addition").length;
  const wallReviewCount = proposals.filter(({ kind }) => kind === "local-wall-review").length;
  if (openingCount > AI_PROPOSAL_MAX_OPENINGS) {
    throw new AiProposalValidationError(`Пакет превышает лимит проёмов ${AI_PROPOSAL_MAX_OPENINGS}.`);
  }
  if (wallReviewCount > AI_PROPOSAL_MAX_WALL_REVIEWS) {
    throw new AiProposalValidationError(
      `Пакет превышает лимит рекомендаций по стенам ${AI_PROPOSAL_MAX_WALL_REVIEWS}.`,
    );
  }

  const rawDiagnostics = array(input.diagnostics, "Диагностика AI-провайдера");
  if (rawDiagnostics.length > AI_PROPOSAL_MAX_DIAGNOSTICS) {
    throw new AiProposalValidationError(`Пакет превышает лимит диагностик ${AI_PROPOSAL_MAX_DIAGNOSTICS}.`);
  }
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId,
    referenceRevision,
    localDraftFingerprint,
    proposals,
    diagnostics: rawDiagnostics.map(providerDiagnostic),
  };
}

function nonEmptyIdentity(value: string, label: string, maximumLength: number): string {
  return text(value, label, maximumLength);
}

function validateIdentityAndEvidence(input: SanitizeAiProposalBatchInput, batch: AiProposalBatch): Readonly<{
  draft: ReturnType<typeof validateRecognitionDraft>;
  fingerprint: string;
}> {
  const draft = validateRecognitionDraft(input.localDraft);
  const fingerprint = createLocalDraftFingerprint(draft);
  const expectedRequestId = nonEmptyIdentity(input.expectedIdentity.requestId, "Ожидаемый requestId", MAX_ID_LENGTH);
  const expectedRevision = nonEmptyIdentity(
    input.expectedIdentity.referenceRevision,
    "Ожидаемая referenceRevision",
    MAX_REFERENCE_REVISION_LENGTH,
  );
  const expectedFingerprint = nonEmptyIdentity(
    input.expectedIdentity.localDraftFingerprint,
    "Ожидаемый fingerprint",
    96,
  );
  const providerId = nonEmptyIdentity(input.provider.providerId, "Provider ID", MAX_ID_LENGTH);
  const modelId = nonEmptyIdentity(input.provider.modelId, "Model ID", MAX_REFERENCE_REVISION_LENGTH);
  const providerRequestId = nonEmptyIdentity(input.provider.requestId, "Provider requestId", MAX_ID_LENGTH);
  void providerId;
  void modelId;

  if (
    batch.requestId !== expectedRequestId
    || batch.referenceRevision !== expectedRevision
    || batch.localDraftFingerprint !== expectedFingerprint
  ) {
    throw new AiProposalValidationError("Пакет AI-предложений относится к другой identity запроса.");
  }
  if (
    draft.referenceRevision !== expectedRevision
    || fingerprint !== expectedFingerprint
    || input.localEvidence.localDraftFingerprint !== fingerprint
  ) {
    throw new AiProposalValidationError("Пакет AI-предложений относится к устаревшему локальному черновику.");
  }
  if (providerRequestId !== expectedRequestId) {
    throw new AiProposalValidationError("Метаданные AI-провайдера относятся к другому запросу.");
  }
  if (
    input.localEvidence.widthPx <= 0
    || input.localEvidence.heightPx <= 0
    || input.localEvidence.structuralMask.widthPx !== input.localEvidence.widthPx
    || input.localEvidence.structuralMask.heightPx !== input.localEvidence.heightPx
  ) {
    throw new AiProposalValidationError("Local evidence snapshot содержит несогласованный structural mask.");
  }
  const activeWallIds = draft.walls
    .filter(({ conflict }) => conflict === null)
    .map(({ id }) => id)
    .sort();
  const evidenceWallIds = [...input.localEvidence.activeWallIds].sort();
  if (
    activeWallIds.length !== evidenceWallIds.length
    || activeWallIds.some((id, index) => id !== evidenceWallIds[index])
  ) {
    throw new AiProposalValidationError("Local evidence snapshot не совпадает с активными стенами Draft.");
  }
  return { draft, fingerprint };
}

function batchRejected(cause: unknown): SanitizeAiProposalBatchResult {
  return {
    sanitized: [],
    diagnostics: [{
      code: "ai-proposal-batch-rejected",
      severity: "error",
      message: cause instanceof Error
        ? cause.message
        : "Пакет AI-предложений отклонён из-за некорректных данных.",
      candidateId: null,
    }],
  };
}

function sanitizedId(requestId: string, rawProposalId: string): string {
  return `ai-proposal:${requestId}:${rawProposalId}`;
}

function preliminaryBlockedProposal(input: Readonly<{
  proposal: AiRecognitionProposal;
  provider: RecognitionAiProviderIdentity;
  localDraftFingerprint: string;
  knownWallIds: ReadonlySet<string>;
}>): SanitizedRecognitionProposal {
  const { proposal, provider, localDraftFingerprint, knownWallIds } = input;
  if (proposal.kind === "opening-addition") {
    const unknownHint = proposal.hostWallHintIds.some((id) => !knownWallIds.has(id));
    return {
      id: sanitizedId(provider.requestId, proposal.id),
      rawProposalId: proposal.id,
      kind: proposal.openingKind,
      state: "blocked",
      geometry: null,
      targetLocalCandidateId: null,
      hostWallCandidateId: null,
      provider: {
        providerId: provider.providerId,
        modelId: provider.modelId,
        requestId: provider.requestId,
      },
      modelConfidence: proposal.modelConfidence,
      deterministicConfidence: "low",
      sourceRegion: proposal.sourceRegion,
      evidence: {
        providerReasons: proposal.reasonCodes,
        validatorReasons: [unknownHint ? "unknown-host-wall-hint" : "opening-sanitizer-pending"],
      },
      localDraftFingerprint,
    };
  }

  const knownTarget = knownWallIds.has(proposal.targetWallCandidateId);
  return {
    id: sanitizedId(provider.requestId, proposal.id),
    rawProposalId: proposal.id,
    kind: "local-wall-review",
    state: "blocked",
    geometry: null,
    targetLocalCandidateId: proposal.targetWallCandidateId,
    hostWallCandidateId: null,
    provider: {
      providerId: provider.providerId,
      modelId: provider.modelId,
      requestId: provider.requestId,
    },
    modelConfidence: proposal.modelConfidence,
    deterministicConfidence: "low",
    sourceRegion: proposal.sourceRegion,
    evidence: {
      providerReasons: proposal.reasonCodes,
      validatorReasons: [knownTarget ? "wall-review-sanitizer-pending" : "unknown-local-wall-target"],
    },
    localDraftFingerprint,
  };
}

function safeProviderDiagnostics(diagnostics: readonly AiProviderDiagnostic[]): RecognitionDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: `ai-provider:${diagnostic.code}`,
    severity: diagnostic.severity,
    message: diagnostic.message,
    candidateId: null,
  }));
}

export function sanitizeAiProposalBatch(
  input: SanitizeAiProposalBatchInput,
): SanitizeAiProposalBatchResult {
  try {
    const batch = validateBatchStructure(input.batch);
    const { draft, fingerprint } = validateIdentityAndEvidence(input, batch);
    const knownWallIds = new Set(draft.walls.map(({ id }) => id));
    return {
      sanitized: batch.proposals.map((proposal) => preliminaryBlockedProposal({
        proposal,
        provider: input.provider,
        localDraftFingerprint: fingerprint,
        knownWallIds,
      })),
      diagnostics: safeProviderDiagnostics(batch.diagnostics),
    };
  } catch (cause) {
    return batchRejected(cause);
  }
}
