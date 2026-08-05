import {
  AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS,
  DEFAULT_RECOGNITION_AI_PROPOSAL_BUDGETS,
  createLocalDraftFingerprint,
  validateRecognitionDraft,
  type RecognitionAiLocalEvidenceSnapshot,
  type RecognitionAiLocalOpeningSummary,
  type RecognitionAiLocalSummary,
  type RecognitionAiLocalWallSummary,
  type RecognitionAiProposalImageInput,
  type RecognitionAiProposalRequest,
  type RecognitionDraft,
} from "@vlezet/recognition";
import {
  renderRecognitionAiOverlay,
  type RecognitionAiOverlayCanvasFactory,
} from "./recognition-ai-overlay";

const MAX_SOURCE_IMAGE_DATA_URL_CHARACTERS = 18 * 1024 * 1024;
const MAX_SUMMARY_REASON_CODES = 16;
const MAX_SUMMARY_ID_LENGTH = 160;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export type BuildRecognitionAiProposalRequestInput = Readonly<{
  requestId: string;
  sourceImageDataUrl: string;
  sourceImage: CanvasImageSource;
  sourceWidthPx: number;
  sourceHeightPx: number;
  referenceRevision: string;
  localDraft: RecognitionDraft;
  evidence: RecognitionAiLocalEvidenceSnapshot;
  canvasFactory?: RecognitionAiOverlayCanvasFactory;
}>;

function nonEmptyText(value: string, label: string, maximumLength = 240): string {
  if (typeof value !== "string") throw new Error(`${label} задан некорректно.`);
  const result = value.trim();
  if (!result || result.length > maximumLength) throw new Error(`${label} задан некорректно.`);
  return result;
}

function positiveDimension(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} задан некорректно.`);
  }
  return value;
}

function safeImageDataUrl(value: string, label: string): string {
  if (
    typeof value !== "string"
    || value.length > MAX_SOURCE_IMAGE_DATA_URL_CHARACTERS
    || !IMAGE_DATA_URL_PATTERN.test(value)
  ) {
    throw new Error(`${label} имеет неподдерживаемый формат или размер.`);
  }
  return value;
}

function compareIds(left: Readonly<{ id: string }>, right: Readonly<{ id: string }>): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function safeId(value: string, label: string): string {
  return nonEmptyText(value, label, MAX_SUMMARY_ID_LENGTH);
}

function canonicalReasons(values: readonly string[], label: string): string[] {
  if (!Array.isArray(values) || values.length > MAX_SUMMARY_REASON_CODES) {
    throw new Error(`${label} превышает безопасный лимит.`);
  }
  const result = values.map((value, index) => nonEmptyText(
    value,
    `${label}[${index}]`,
    160,
  )).sort();
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} содержит повторяющиеся значения.`);
  }
  return result;
}

function sameSortedIds(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((value, index) => value === expected[index]);
}

function validateEvidenceIdentity(
  localDraft: ReturnType<typeof validateRecognitionDraft>,
  evidence: RecognitionAiLocalEvidenceSnapshot,
  widthPx: number,
  heightPx: number,
): RecognitionAiLocalEvidenceSnapshot {
  if (!evidence || typeof evidence !== "object") {
    throw new Error("Локальный evidence snapshot отсутствует.");
  }
  if (
    evidence.widthPx !== widthPx
    || evidence.heightPx !== heightPx
    || evidence.structuralMask.widthPx !== widthPx
    || evidence.structuralMask.heightPx !== heightPx
  ) {
    throw new Error("Размер локального evidence snapshot не совпадает с исходным растром.");
  }
  const fingerprint = createLocalDraftFingerprint(localDraft);
  if (evidence.localDraftFingerprint !== fingerprint) {
    throw new Error("Локальный evidence snapshot относится к изменённому черновику.");
  }

  const expectedActiveWallIds = localDraft.walls
    .filter((wall) => wall.conflict === null)
    .map((wall) => wall.id)
    .sort();
  const actualActiveWallIds = evidence.activeWallIds
    .map((id) => safeId(id, "Идентификатор активной стены"))
    .sort();
  if (!sameSortedIds(actualActiveWallIds, expectedActiveWallIds)) {
    throw new Error("Локальный evidence snapshot не совпадает с активными стенами черновика.");
  }

  const wallIds = new Set(localDraft.walls.map((wall) => wall.id));
  const activeWallIds = new Set(expectedActiveWallIds);
  const openingsById = new Map(localDraft.openings.map((opening) => [opening.id, opening]));
  for (const item of [...evidence.doorEvidence, ...evidence.windowEvidence]) {
    const opening = openingsById.get(item.openingCandidateId);
    if (
      !opening
      || opening.hostWallCandidateId !== item.hostWallCandidateId
      || !activeWallIds.has(item.hostWallCandidateId)
    ) {
      throw new Error("Opening evidence содержит неизвестную ссылку.");
    }
  }
  for (const item of evidence.clutterEvidence) {
    const wall = localDraft.walls.find((candidate) => candidate.id === item.wallCandidateId);
    if (!wall || !wallIds.has(item.wallCandidateId) || wall.conflict === null) {
      throw new Error("Clutter evidence содержит неизвестную ссылку.");
    }
  }
  return evidence;
}

function wallSummary(
  localDraft: ReturnType<typeof validateRecognitionDraft>,
): RecognitionAiLocalWallSummary[] {
  return [...localDraft.walls].sort(compareIds).map((wall) => ({
    id: safeId(wall.id, "Идентификатор стены"),
    start: wall.start,
    end: wall.end,
    estimatedThicknessPx: wall.estimatedThicknessPx,
    confidence: wall.confidence,
    conflict: wall.conflict,
    localScore: wall.evidence.localScore,
    reasonCodes: canonicalReasons(wall.evidence.reasons, `Evidence стены ${wall.id}`),
  }));
}

function openingSummary(
  localDraft: ReturnType<typeof validateRecognitionDraft>,
): RecognitionAiLocalOpeningSummary[] {
  return [...localDraft.openings].sort(compareIds).map((opening) => ({
    id: safeId(opening.id, "Идентификатор проёма"),
    kind: opening.kind,
    hostWallCandidateId: opening.hostWallCandidateId,
    center: opening.center,
    widthPx: opening.widthPx,
    orientationDeg: opening.orientationDeg,
    confidence: opening.confidence,
    conflict: opening.conflict,
    localScore: opening.evidence.localScore,
    reasonCodes: canonicalReasons(opening.evidence.reasons, `Evidence проёма ${opening.id}`),
  }));
}

function canonicalEvidence<T extends Readonly<{
  reasonCodes: readonly string[];
}>>(values: readonly T[], identity: (value: T) => string, label: string): T[] {
  return [...values]
    .map((value) => ({
      ...value,
      reasonCodes: canonicalReasons(value.reasonCodes, `${label} ${identity(value)}`),
    }))
    .sort((left, right) => {
      const leftId = identity(left);
      const rightId = identity(right);
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });
}

function localSummary(
  localDraft: ReturnType<typeof validateRecognitionDraft>,
  evidence: RecognitionAiLocalEvidenceSnapshot,
): RecognitionAiLocalSummary {
  return {
    activeWallIds: [...evidence.activeWallIds].sort(),
    planBounds: evidence.planBounds,
    walls: wallSummary(localDraft),
    openings: openingSummary(localDraft),
    doorEvidence: canonicalEvidence(
      evidence.doorEvidence,
      (item) => item.openingCandidateId,
      "Door evidence",
    ),
    windowEvidence: canonicalEvidence(
      evidence.windowEvidence,
      (item) => item.openingCandidateId,
      "Window evidence",
    ),
    clutterEvidence: canonicalEvidence(
      evidence.clutterEvidence,
      (item) => item.wallCandidateId,
      "Clutter evidence",
    ),
  };
}

export function buildRecognitionAiProposalRequest(
  input: BuildRecognitionAiProposalRequestInput,
): RecognitionAiProposalRequest {
  const requestId = nonEmptyText(input.requestId, "Идентификатор запроса", 160);
  const referenceRevision = nonEmptyText(input.referenceRevision, "Ревизия подложки");
  const widthPx = positiveDimension(input.sourceWidthPx, "Ширина исходного растра");
  const heightPx = positiveDimension(input.sourceHeightPx, "Высота исходного растра");
  if (widthPx * heightPx > AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS) {
    throw new Error("Исходный растр превышает безопасный pixel budget.");
  }
  const sourceImageDataUrl = safeImageDataUrl(input.sourceImageDataUrl, "Исходное изображение");
  if (!input.sourceImage) throw new Error("Исходное изображение недоступно.");
  const localDraft = validateRecognitionDraft(input.localDraft);
  if (localDraft.referenceRevision !== referenceRevision) {
    throw new Error("Ревизия подложки не совпадает с локальным черновиком.");
  }
  const evidence = validateEvidenceIdentity(localDraft, input.evidence, widthPx, heightPx);
  const overlayImageDataUrl = renderRecognitionAiOverlay({
    sourceImage: input.sourceImage,
    widthPx,
    heightPx,
    localDraft,
    canvasFactory: input.canvasFactory,
  });

  return {
    mode: "proposal-discovery-stage1",
    requestId,
    referenceRevision,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    imageWidthPx: widthPx,
    imageHeightPx: heightPx,
    sourceImageDataUrl,
    overlayImageDataUrl,
    localSummary: localSummary(localDraft, evidence),
    budgets: DEFAULT_RECOGNITION_AI_PROPOSAL_BUDGETS,
  };
}

export function recognitionAiProposalImageInputs(
  request: RecognitionAiProposalRequest,
): readonly [RecognitionAiProposalImageInput, RecognitionAiProposalImageInput] {
  return [
    { type: "image_url", image_url: { url: request.sourceImageDataUrl } },
    { type: "image_url", image_url: { url: request.overlayImageDataUrl } },
  ];
}
