import { AiProposalValidationError } from "./ai-proposals";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { NormalizedPoint, RecognitionDraft } from "./model";
import { validateRecognitionDraft } from "./model";
import type {
  OpeningHypothesisRejection,
  OpeningHypothesisRejectionCode,
} from "./opening-analysis";

export const AI_REJECTED_OPENING_EVIDENCE_MAX_ITEMS = 48;
const MAX_REASON_CODES = 16;
const MAX_REASON_LENGTH = 160;
const MAX_REGISTRY_ITEMS = 8;
const MAX_PIXELS = 8_000_000;

const REJECTION_CODES: readonly OpeningHypothesisRejectionCode[] = [
  "unknown-host-wall",
  "invalid-host-wall",
  "invalid-opening-width",
  "opening-too-far-from-host",
  "opening-outside-host-span",
  "opening-end-margin",
  "opening-overlap",
];

export type RecognitionAiRejectedOpeningEvidence = Readonly<{
  openingCandidateId: string;
  kind: "door" | "window" | "unknown-opening";
  hostWallCandidateId: string | null;
  center: NormalizedPoint;
  widthPx: number | null;
  orientationDeg: number | null;
  rejectionCode: OpeningHypothesisRejectionCode;
  reasonCodes: readonly string[];
}>;

export type RecognitionAiRejectedOpeningEvidenceTransfer = Readonly<{
  localDraftFingerprint: string;
  widthPx: number;
  heightPx: number;
  items: readonly RecognitionAiRejectedOpeningEvidence[];
}>;

export type CreateRejectedOpeningEvidenceTransferInput = Readonly<{
  localDraft: RecognitionDraft;
  rejections: readonly OpeningHypothesisRejection[];
  analysisWidthPx: number;
  analysisHeightPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
}>;

const evidenceByFingerprint = new Map<string, RecognitionAiRejectedOpeningEvidenceTransfer>();

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AiProposalValidationError(`${label} должен быть положительным целым числом.`);
  }
  return value;
}

function validateDimensions(widthPx: number, heightPx: number, label: string): void {
  positiveInteger(widthPx, `${label}.widthPx`);
  positiveInteger(heightPx, `${label}.heightPx`);
  if (widthPx * heightPx > MAX_PIXELS) {
    throw new AiProposalValidationError(`${label} превышает безопасный pixel budget.`);
  }
}

function nonEmptyText(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > MAX_REASON_LENGTH) {
    throw new AiProposalValidationError(`${label} должен быть непустой строкой допустимой длины.`);
  }
  return value.trim();
}

function finiteNormalizedPoint(point: NormalizedPoint, label: string): NormalizedPoint {
  if (
    !point
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || point.x < 0
    || point.x > 1
    || point.y < 0
    || point.y > 1
  ) {
    throw new AiProposalValidationError(`${label} выходит за нормализованный растр.`);
  }
  return { x: point.x, y: point.y };
}

function nullablePositive(value: number | null, label: string): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) {
    throw new AiProposalValidationError(`${label} должен быть положительным конечным числом или null.`);
  }
  return value;
}

function nullableOrientation(value: number | null, label: string): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value >= 180) {
    throw new AiProposalValidationError(`${label} должен быть от 0 до 180 градусов исключительно или null.`);
  }
  return value;
}

function reasonCodes(values: readonly string[], label: string): string[] {
  if (!Array.isArray(values) || values.length > MAX_REASON_CODES) {
    throw new AiProposalValidationError(`${label} превышает безопасный лимит.`);
  }
  const result = values.map((value, index) => nonEmptyText(value, `${label}[${index}]`)).sort();
  if (new Set(result).size !== result.length) {
    throw new AiProposalValidationError(`${label} содержит повторяющиеся значения.`);
  }
  return result;
}

function openingKind(value: string): RecognitionAiRejectedOpeningEvidence["kind"] {
  if (value !== "door" && value !== "window" && value !== "unknown-opening") {
    throw new AiProposalValidationError("Rejected opening evidence содержит неподдерживаемый kind.");
  }
  return value;
}

function rejectionCode(value: OpeningHypothesisRejectionCode): OpeningHypothesisRejectionCode {
  if (!REJECTION_CODES.includes(value)) {
    throw new AiProposalValidationError("Rejected opening evidence содержит неподдерживаемый rejection code.");
  }
  return value;
}

function validateTransfer(
  localDraft: RecognitionDraft,
  transfer: RecognitionAiRejectedOpeningEvidenceTransfer,
): RecognitionAiRejectedOpeningEvidenceTransfer {
  const draft = validateRecognitionDraft(localDraft);
  validateDimensions(transfer.widthPx, transfer.heightPx, "Rejected opening evidence transfer");
  const fingerprint = createLocalDraftFingerprint(draft);
  if (transfer.localDraftFingerprint !== fingerprint) {
    throw new AiProposalValidationError("Rejected opening evidence относится к другому локальному черновику.");
  }
  if (!Array.isArray(transfer.items) || transfer.items.length > AI_REJECTED_OPENING_EVIDENCE_MAX_ITEMS) {
    throw new AiProposalValidationError(
      `Rejected opening evidence превышает безопасный лимит ${AI_REJECTED_OPENING_EVIDENCE_MAX_ITEMS}.`,
    );
  }
  const activeWallIds = new Set(
    draft.walls.filter(({ conflict }) => conflict === null).map(({ id }) => id),
  );
  const activeOpeningIds = new Set(draft.openings.map(({ id }) => id));
  const ids = transfer.items.map(({ openingCandidateId }) => nonEmptyText(
    openingCandidateId,
    "Rejected opening evidence.openingCandidateId",
  ));
  if (new Set(ids).size !== ids.length) {
    throw new AiProposalValidationError("Rejected opening evidence содержит повторяющиеся opening IDs.");
  }

  const items = transfer.items.map((item) => {
    const id = nonEmptyText(item.openingCandidateId, "Rejected opening evidence.openingCandidateId");
    if (activeOpeningIds.has(id)) {
      throw new AiProposalValidationError("Rejected opening evidence дублирует активный opening Draft.");
    }
    const hostWallCandidateId = item.hostWallCandidateId === null
      ? null
      : nonEmptyText(item.hostWallCandidateId, "Rejected opening evidence.hostWallCandidateId");
    if (hostWallCandidateId !== null && !activeWallIds.has(hostWallCandidateId)) {
      throw new AiProposalValidationError("Rejected opening evidence ссылается на неподтверждённую host wall.");
    }
    return {
      openingCandidateId: id,
      kind: openingKind(item.kind),
      hostWallCandidateId,
      center: finiteNormalizedPoint(item.center, "Rejected opening evidence.center"),
      widthPx: nullablePositive(item.widthPx, "Rejected opening evidence.widthPx"),
      orientationDeg: nullableOrientation(
        item.orientationDeg,
        "Rejected opening evidence.orientationDeg",
      ),
      rejectionCode: rejectionCode(item.rejectionCode),
      reasonCodes: reasonCodes(item.reasonCodes, "Rejected opening evidence.reasonCodes"),
    } satisfies RecognitionAiRejectedOpeningEvidence;
  }).sort((left, right) => left.openingCandidateId.localeCompare(right.openingCandidateId));

  return {
    localDraftFingerprint: fingerprint,
    widthPx: transfer.widthPx,
    heightPx: transfer.heightPx,
    items,
  };
}

export function createRejectedOpeningEvidenceTransfer(
  input: CreateRejectedOpeningEvidenceTransferInput,
): RecognitionAiRejectedOpeningEvidenceTransfer {
  const draft = validateRecognitionDraft(input.localDraft);
  validateDimensions(input.analysisWidthPx, input.analysisHeightPx, "Analysis raster");
  validateDimensions(input.sourceWidthPx, input.sourceHeightPx, "Source raster");
  if (input.rejections.length > AI_REJECTED_OPENING_EVIDENCE_MAX_ITEMS) {
    throw new AiProposalValidationError(
      `Rejected opening evidence превышает безопасный лимит ${AI_REJECTED_OPENING_EVIDENCE_MAX_ITEMS}.`,
    );
  }
  const activeWallIds = new Set(
    draft.walls.filter(({ conflict }) => conflict === null).map(({ id }) => id),
  );
  const widthScale = Math.sqrt(
    (input.sourceWidthPx / input.analysisWidthPx)
    * (input.sourceHeightPx / input.analysisHeightPx),
  );
  const rawItems = input.rejections.map((rejection) => {
    const candidate = rejection.candidate;
    if (
      rejection.hostWallCandidateId !== candidate.hostWallCandidateId
      || (rejection.hostWallCandidateId !== null && !activeWallIds.has(rejection.hostWallCandidateId))
    ) {
      throw new AiProposalValidationError("Rejected opening evidence ссылается на неподтверждённую host wall.");
    }
    return {
      openingCandidateId: rejection.candidateId,
      kind: candidate.kind,
      hostWallCandidateId: rejection.hostWallCandidateId,
      center: candidate.center,
      widthPx: candidate.widthPx === null ? null : candidate.widthPx * widthScale,
      orientationDeg: candidate.orientationDeg,
      rejectionCode: rejection.code,
      reasonCodes: candidate.evidence.reasons,
    } satisfies RecognitionAiRejectedOpeningEvidence;
  });
  return validateTransfer(draft, {
    localDraftFingerprint: createLocalDraftFingerprint(draft),
    widthPx: input.sourceWidthPx,
    heightPx: input.sourceHeightPx,
    items: rawItems,
  });
}

export function registerAiRejectedOpeningEvidenceForDraft(
  localDraft: RecognitionDraft,
  transfer: RecognitionAiRejectedOpeningEvidenceTransfer,
): void {
  const validated = validateTransfer(localDraft, transfer);
  evidenceByFingerprint.delete(validated.localDraftFingerprint);
  evidenceByFingerprint.set(validated.localDraftFingerprint, validated);
  while (evidenceByFingerprint.size > MAX_REGISTRY_ITEMS) {
    const oldest = evidenceByFingerprint.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    evidenceByFingerprint.delete(oldest);
  }
}

export function peekAiRejectedOpeningEvidenceForDraft(
  localDraft: RecognitionDraft,
): RecognitionAiRejectedOpeningEvidenceTransfer | null {
  return evidenceByFingerprint.get(createLocalDraftFingerprint(localDraft)) ?? null;
}

export function clearAiRejectedOpeningEvidenceForDraft(localDraft: RecognitionDraft): void {
  evidenceByFingerprint.delete(createLocalDraftFingerprint(localDraft));
}
