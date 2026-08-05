import type { NormalizedPoint } from "./model";

export const AI_PROPOSAL_SCHEMA_VERSION = "recognition-ai-proposals-v1" as const;
export const AI_PROPOSAL_MAX_OPENINGS = 12;
export const AI_PROPOSAL_MAX_WALL_REVIEWS = 12;
export const AI_PROPOSAL_MAX_DIAGNOSTICS = 20;

const AI_PROPOSAL_MAX_HOST_HINTS = 8;
const AI_PROPOSAL_MAX_REASON_CODES = 8;
const AI_PROPOSAL_MAX_VALIDATOR_REASONS = 16;
const AI_PROPOSAL_MAX_TEXT_LENGTH = 1_000;

export const AI_OPENING_REASON_CODES = [
  "visible-gap",
  "door-leaf",
  "door-arc",
  "parallel-window-rails",
  "window-frame",
  "structural-support",
  "exterior-boundary-context",
  "balcony-boundary-context",
  "host-wall-hint",
] as const;

export const AI_WALL_REVIEW_REASON_CODES = [
  "sanitary-symbol-overlap",
  "furniture-symbol-overlap",
  "weak-structural-mask-support",
  "topology-unsupported",
  "short-clutter-profile",
] as const;

export type AiOpeningReasonCode = typeof AI_OPENING_REASON_CODES[number];
export type AiWallReviewReasonCode = typeof AI_WALL_REVIEW_REASON_CODES[number];

export type NormalizedBox = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type AiOpeningAdditionProposal = Readonly<{
  id: string;
  kind: "opening-addition";
  openingKind: "door" | "window";
  center: NormalizedPoint;
  widthNormalized: number;
  orientationDeg: number;
  hostWallHintIds: readonly string[];
  sourceRegion: NormalizedBox;
  modelConfidence: number;
  reasonCodes: readonly AiOpeningReasonCode[];
}>;

export type AiLocalWallReviewProposal = Readonly<{
  id: string;
  kind: "local-wall-review";
  targetWallCandidateId: string;
  recommendation: "likely-clutter";
  sourceRegion: NormalizedBox;
  modelConfidence: number;
  reasonCodes: readonly AiWallReviewReasonCode[];
}>;

export type AiRecognitionProposal = AiOpeningAdditionProposal | AiLocalWallReviewProposal;

export type AiProviderDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
}>;

export type AiProposalBatch = Readonly<{
  schemaVersion: typeof AI_PROPOSAL_SCHEMA_VERSION;
  requestId: string;
  referenceRevision: string;
  localDraftFingerprint: string;
  proposals: readonly AiRecognitionProposal[];
  diagnostics: readonly AiProviderDiagnostic[];
}>;

export type SanitizedOpeningProposalGeometry = Readonly<{
  kind: "opening";
  center: NormalizedPoint;
  widthNormalized: number;
  orientationDeg: number;
}>;

export type SanitizedProposalGeometry = SanitizedOpeningProposalGeometry;

export type SanitizedRecognitionProposal = Readonly<{
  id: string;
  rawProposalId: string;
  kind: "door" | "window" | "local-wall-review";
  state: "eligible" | "blocked" | "duplicate";
  geometry: SanitizedProposalGeometry | null;
  targetLocalCandidateId: string | null;
  hostWallCandidateId: string | null;
  provider: Readonly<{
    providerId: string;
    modelId: string;
    requestId: string;
  }>;
  modelConfidence: number;
  deterministicConfidence: "medium" | "low";
  sourceRegion: NormalizedBox;
  evidence: Readonly<{
    providerReasons: readonly string[];
    validatorReasons: readonly string[];
  }>;
  localDraftFingerprint: string;
}>;

export type RecognitionProposalDecision = "pending" | "accepted" | "rejected";
export type RecognitionProposalDecisionMap = Readonly<Record<string, RecognitionProposalDecision>>;

export type RecognitionAiProposalMetadata = Readonly<{
  schemaVersion: typeof AI_PROPOSAL_SCHEMA_VERSION;
  requestId: string;
  referenceRevision: string;
  localDraftFingerprint: string;
  providerId: string;
  modelId: string;
  completedAt: string;
}>;

export type RecognitionAiProposalDraftState = Readonly<{
  aiProposals: readonly SanitizedRecognitionProposal[];
  proposalDecisions: RecognitionProposalDecisionMap;
  aiProposalMetadata: RecognitionAiProposalMetadata | null;
}>;

export class AiProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProposalValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiProposalValidationError(`${label} содержит некорректные данные.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new AiProposalValidationError(`${label} должен быть списком.`);
  return value;
}

function text(value: unknown, label: string, maximumLength = AI_PROPOSAL_MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") throw new AiProposalValidationError(`${label} должен быть строкой.`);
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
    throw new AiProposalValidationError(`${label} должен быть от ${minimum} до ${maximum}.`);
  }
  return result;
}

function positiveBounded(value: unknown, maximum: number, label: string): number {
  const result = bounded(value, 0, maximum, label);
  if (result <= 0) throw new AiProposalValidationError(`${label} должен быть больше нуля.`);
  return result;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new AiProposalValidationError(`${label} содержит неподдерживаемое значение.`);
  }
  return value as T;
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (Number.isNaN(Date.parse(result))) throw new AiProposalValidationError(`${label} содержит некорректную дату.`);
  return result;
}

function fingerprint(value: unknown, label: string): string {
  const result = text(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) {
    throw new AiProposalValidationError(`${label} должен быть SHA-256 в нижнем регистре.`);
  }
  return result;
}

function normalizedPoint(value: unknown, label: string): NormalizedPoint {
  const input = record(value, label);
  return {
    x: bounded(input.x, 0, 1, `${label}.x`),
    y: bounded(input.y, 0, 1, `${label}.y`),
  };
}

function normalizedBox(value: unknown, label: string): NormalizedBox {
  const input = record(value, label);
  const result = {
    x: bounded(input.x, 0, 1, `${label}.x`),
    y: bounded(input.y, 0, 1, `${label}.y`),
    width: positiveBounded(input.width, 1, `${label}.width`),
    height: positiveBounded(input.height, 1, `${label}.height`),
  };
  if (result.x + result.width > 1 + Number.EPSILON || result.y + result.height > 1 + Number.EPSILON) {
    throw new AiProposalValidationError(`${label} выходит за границы нормализованного изображения.`);
  }
  return result;
}

function uniqueTextList(
  value: unknown,
  label: string,
  maximumItems: number,
  allowList?: readonly string[],
): string[] {
  const values = array(value, label);
  if (values.length > maximumItems) {
    throw new AiProposalValidationError(`${label} превышает допустимый лимит ${maximumItems}.`);
  }
  const result = values.map((entry, index) => text(entry, `${label}[${index}]`, 160));
  if (new Set(result).size !== result.length) {
    throw new AiProposalValidationError(`${label} содержит повторяющиеся значения.`);
  }
  if (allowList && result.some((entry) => !allowList.includes(entry))) {
    throw new AiProposalValidationError(`${label} содержит неподдерживаемый код.`);
  }
  return result;
}

function validateOpeningProposal(value: unknown, index: number): AiOpeningAdditionProposal {
  const label = `AI-предложение проёма ${index + 1}`;
  const input = record(value, label);
  if (input.kind !== "opening-addition") {
    throw new AiProposalValidationError(`${label}.kind содержит неподдерживаемое значение.`);
  }
  return {
    id: text(input.id, `${label}.id`, 160),
    kind: "opening-addition",
    openingKind: oneOf(input.openingKind, ["door", "window"] as const, `${label}.openingKind`),
    center: normalizedPoint(input.center, `${label}.center`),
    widthNormalized: positiveBounded(input.widthNormalized, 1, `${label}.widthNormalized`),
    orientationDeg: bounded(input.orientationDeg, 0, 179.999_999, `${label}.orientationDeg`),
    hostWallHintIds: uniqueTextList(input.hostWallHintIds, `${label}.hostWallHintIds`, AI_PROPOSAL_MAX_HOST_HINTS),
    sourceRegion: normalizedBox(input.sourceRegion, `${label}.sourceRegion`),
    modelConfidence: bounded(input.modelConfidence, 0, 1, `${label}.modelConfidence`),
    reasonCodes: uniqueTextList(
      input.reasonCodes,
      `${label}.reasonCodes`,
      AI_PROPOSAL_MAX_REASON_CODES,
      AI_OPENING_REASON_CODES,
    ) as AiOpeningReasonCode[],
  };
}

function validateWallReviewProposal(value: unknown, index: number): AiLocalWallReviewProposal {
  const label = `AI-рекомендация по стене ${index + 1}`;
  const input = record(value, label);
  if (input.kind !== "local-wall-review") {
    throw new AiProposalValidationError(`${label}.kind содержит неподдерживаемое значение.`);
  }
  if (input.recommendation !== "likely-clutter") {
    throw new AiProposalValidationError(`${label}.recommendation содержит неподдерживаемое значение.`);
  }
  return {
    id: text(input.id, `${label}.id`, 160),
    kind: "local-wall-review",
    targetWallCandidateId: text(input.targetWallCandidateId, `${label}.targetWallCandidateId`, 160),
    recommendation: "likely-clutter",
    sourceRegion: normalizedBox(input.sourceRegion, `${label}.sourceRegion`),
    modelConfidence: bounded(input.modelConfidence, 0, 1, `${label}.modelConfidence`),
    reasonCodes: uniqueTextList(
      input.reasonCodes,
      `${label}.reasonCodes`,
      AI_PROPOSAL_MAX_REASON_CODES,
      AI_WALL_REVIEW_REASON_CODES,
    ) as AiWallReviewReasonCode[],
  };
}

function validateRawProposal(value: unknown, index: number): AiRecognitionProposal {
  const input = record(value, `AI-предложение ${index + 1}`);
  const kind = oneOf(
    input.kind,
    ["opening-addition", "local-wall-review"] as const,
    `AI-предложение ${index + 1}.kind`,
  );
  return kind === "opening-addition"
    ? validateOpeningProposal(input, index)
    : validateWallReviewProposal(input, index);
}

function validateProviderDiagnostic(value: unknown, index: number): AiProviderDiagnostic {
  const label = `Диагностика AI-провайдера ${index + 1}`;
  const input = record(value, label);
  return {
    code: text(input.code, `${label}.code`, 160),
    severity: oneOf(input.severity, ["info", "warning", "error"] as const, `${label}.severity`),
    message: text(input.message, `${label}.message`),
  };
}

export function validateAiProposalBatch(value: unknown): AiProposalBatch {
  const input = record(value, "Пакет AI-предложений");
  if (input.schemaVersion !== AI_PROPOSAL_SCHEMA_VERSION) {
    throw new AiProposalValidationError("Пакет AI-предложений использует неподдерживаемую версию схемы.");
  }
  const proposals = array(input.proposals, "AI-предложения").map(validateRawProposal);
  const proposalIds = proposals.map((proposal) => proposal.id);
  if (new Set(proposalIds).size !== proposalIds.length) {
    throw new AiProposalValidationError("Идентификаторы AI-предложений должны быть уникальными.");
  }
  const openingCount = proposals.filter((proposal) => proposal.kind === "opening-addition").length;
  const wallReviewCount = proposals.filter((proposal) => proposal.kind === "local-wall-review").length;
  if (openingCount > AI_PROPOSAL_MAX_OPENINGS) {
    throw new AiProposalValidationError(`Пакет превышает лимит проёмов ${AI_PROPOSAL_MAX_OPENINGS}.`);
  }
  if (wallReviewCount > AI_PROPOSAL_MAX_WALL_REVIEWS) {
    throw new AiProposalValidationError(`Пакет превышает лимит рекомендаций по стенам ${AI_PROPOSAL_MAX_WALL_REVIEWS}.`);
  }
  const diagnosticsInput = array(input.diagnostics, "Диагностика AI-провайдера");
  if (diagnosticsInput.length > AI_PROPOSAL_MAX_DIAGNOSTICS) {
    throw new AiProposalValidationError(`Пакет превышает лимит диагностик ${AI_PROPOSAL_MAX_DIAGNOSTICS}.`);
  }
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId: text(input.requestId, "Пакет AI-предложений.requestId", 160),
    referenceRevision: text(input.referenceRevision, "Пакет AI-предложений.referenceRevision", 200),
    localDraftFingerprint: fingerprint(
      input.localDraftFingerprint,
      "Пакет AI-предложений.localDraftFingerprint",
    ),
    proposals,
    diagnostics: diagnosticsInput.map(validateProviderDiagnostic),
  };
}

function validateSanitizedGeometry(value: unknown, label: string): SanitizedOpeningProposalGeometry {
  const input = record(value, label);
  if (input.kind !== "opening") {
    throw new AiProposalValidationError(`${label}.kind содержит неподдерживаемое значение.`);
  }
  return {
    kind: "opening",
    center: normalizedPoint(input.center, `${label}.center`),
    widthNormalized: positiveBounded(input.widthNormalized, 1, `${label}.widthNormalized`),
    orientationDeg: bounded(input.orientationDeg, 0, 179.999_999, `${label}.orientationDeg`),
  };
}

export function validateSanitizedRecognitionProposal(value: unknown): SanitizedRecognitionProposal {
  const input = record(value, "Проверенное AI-предложение");
  const kind = oneOf(
    input.kind,
    ["door", "window", "local-wall-review"] as const,
    "Проверенное AI-предложение.kind",
  );
  const state = oneOf(
    input.state,
    ["eligible", "blocked", "duplicate"] as const,
    "Проверенное AI-предложение.state",
  );
  const geometry = input.geometry === null
    ? null
    : validateSanitizedGeometry(input.geometry, "Проверенное AI-предложение.geometry");
  const targetLocalCandidateId = nullableText(
    input.targetLocalCandidateId,
    "Проверенное AI-предложение.targetLocalCandidateId",
  );
  const hostWallCandidateId = nullableText(
    input.hostWallCandidateId,
    "Проверенное AI-предложение.hostWallCandidateId",
  );

  if (kind === "local-wall-review") {
    if (geometry !== null || !targetLocalCandidateId || hostWallCandidateId !== null) {
      throw new AiProposalValidationError("Рекомендация по локальной стене содержит несовместимую геометрию или host wall.");
    }
  } else {
    if (!geometry || targetLocalCandidateId !== null) {
      throw new AiProposalValidationError("Предложение проёма должно содержать геометрию и не должно иметь local target.");
    }
    if (state === "eligible" && !hostWallCandidateId) {
      throw new AiProposalValidationError("Допустимое предложение проёма обязано иметь проверенную host wall.");
    }
  }

  const provider = record(input.provider, "Проверенное AI-предложение.provider");
  const evidence = record(input.evidence, "Проверенное AI-предложение.evidence");
  return {
    id: text(input.id, "Проверенное AI-предложение.id", 160),
    rawProposalId: text(input.rawProposalId, "Проверенное AI-предложение.rawProposalId", 160),
    kind,
    state,
    geometry,
    targetLocalCandidateId,
    hostWallCandidateId,
    provider: {
      providerId: text(provider.providerId, "Проверенное AI-предложение.provider.providerId", 160),
      modelId: text(provider.modelId, "Проверенное AI-предложение.provider.modelId", 240),
      requestId: text(provider.requestId, "Проверенное AI-предложение.provider.requestId", 160),
    },
    modelConfidence: bounded(input.modelConfidence, 0, 1, "Проверенное AI-предложение.modelConfidence"),
    deterministicConfidence: oneOf(
      input.deterministicConfidence,
      ["medium", "low"] as const,
      "Проверенное AI-предложение.deterministicConfidence",
    ),
    sourceRegion: normalizedBox(input.sourceRegion, "Проверенное AI-предложение.sourceRegion"),
    evidence: {
      providerReasons: uniqueTextList(
        evidence.providerReasons,
        "Проверенное AI-предложение.evidence.providerReasons",
        AI_PROPOSAL_MAX_REASON_CODES,
      ),
      validatorReasons: uniqueTextList(
        evidence.validatorReasons,
        "Проверенное AI-предложение.evidence.validatorReasons",
        AI_PROPOSAL_MAX_VALIDATOR_REASONS,
      ),
    },
    localDraftFingerprint: fingerprint(
      input.localDraftFingerprint,
      "Проверенное AI-предложение.localDraftFingerprint",
    ),
  };
}

export function validateRecognitionAiProposalMetadata(value: unknown): RecognitionAiProposalMetadata | null {
  if (value === null) return null;
  const input = record(value, "Метаданные AI-предложений");
  if (input.schemaVersion !== AI_PROPOSAL_SCHEMA_VERSION) {
    throw new AiProposalValidationError("Метаданные AI-предложений используют неподдерживаемую версию схемы.");
  }
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId: text(input.requestId, "Метаданные AI-предложений.requestId", 160),
    referenceRevision: text(input.referenceRevision, "Метаданные AI-предложений.referenceRevision", 200),
    localDraftFingerprint: fingerprint(
      input.localDraftFingerprint,
      "Метаданные AI-предложений.localDraftFingerprint",
    ),
    providerId: text(input.providerId, "Метаданные AI-предложений.providerId", 160),
    modelId: text(input.modelId, "Метаданные AI-предложений.modelId", 240),
    completedAt: timestamp(input.completedAt, "Метаданные AI-предложений.completedAt"),
  };
}

export function validateRecognitionProposalDecision(value: unknown, label: string): RecognitionProposalDecision {
  return oneOf(value, ["pending", "accepted", "rejected"] as const, label);
}

export function emptyAiProposalDraftState(): RecognitionAiProposalDraftState {
  return {
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
  };
}

export function validateAiProposalDraftState(value: Readonly<{
  aiProposals: unknown;
  proposalDecisions: unknown;
  aiProposalMetadata: unknown;
}>): RecognitionAiProposalDraftState {
  const aiProposals = array(value.aiProposals, "Проверенные AI-предложения")
    .map(validateSanitizedRecognitionProposal);
  const proposalIds = aiProposals.map((proposal) => proposal.id);
  if (new Set(proposalIds).size !== proposalIds.length) {
    throw new AiProposalValidationError("Идентификаторы проверенных AI-предложений должны быть уникальными.");
  }
  const knownProposalIds = new Set(proposalIds);
  const decisionsInput = record(value.proposalDecisions, "Решения по AI-предложениям");
  const proposalDecisions: Record<string, RecognitionProposalDecision> = {};
  for (const [proposalId, decision] of Object.entries(decisionsInput)) {
    if (!knownProposalIds.has(proposalId)) {
      throw new AiProposalValidationError(`Решение ссылается на неизвестное AI-предложение ${proposalId}.`);
    }
    const validatedDecision = validateRecognitionProposalDecision(decision, `Решение по AI-предложению ${proposalId}`);
    const proposal = aiProposals.find((candidate) => candidate.id === proposalId)!;
    if (validatedDecision === "accepted" && proposal.state !== "eligible") {
      throw new AiProposalValidationError("Заблокированное или дублирующее AI-предложение нельзя принять.");
    }
    proposalDecisions[proposalId] = validatedDecision;
  }
  const aiProposalMetadata = validateRecognitionAiProposalMetadata(value.aiProposalMetadata);
  if (aiProposals.length > 0 && !aiProposalMetadata) {
    throw new AiProposalValidationError("Проверенные AI-предложения требуют метаданные пакета.");
  }
  if (aiProposalMetadata) {
    for (const proposal of aiProposals) {
      if (
        proposal.provider.requestId !== aiProposalMetadata.requestId ||
        proposal.provider.providerId !== aiProposalMetadata.providerId ||
        proposal.provider.modelId !== aiProposalMetadata.modelId ||
        proposal.localDraftFingerprint !== aiProposalMetadata.localDraftFingerprint
      ) {
        throw new AiProposalValidationError("AI-предложение не согласовано с метаданными пакета.");
      }
    }
  }
  return { aiProposals, proposalDecisions, aiProposalMetadata };
}
