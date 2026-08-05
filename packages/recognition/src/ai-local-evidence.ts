import type { NormalizedBox } from "./ai-proposals";
import { AiProposalValidationError } from "./ai-proposals";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type {
  RecognitionDraft,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { validateRecognitionDraft } from "./model";
import { takePendingAiLocalEvidenceContext } from "./recognition-runtime-context";
import type { StructuralMaskView } from "./wall-completion";

export const AI_LOCAL_EVIDENCE_MAX_ACTIVE_WALLS = 160;
export const AI_LOCAL_EVIDENCE_MAX_CATEGORY_ITEMS = 48;
export const AI_LOCAL_EVIDENCE_MAX_REASON_CODES = 16;
export const AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS = 8_000_000;
const AI_LOCAL_EVIDENCE_REGISTRY_LIMIT = 8;

export type RecognitionAiDoorEvidence = Readonly<{
  openingCandidateId: string;
  hostWallCandidateId: string;
  reasonCodes: readonly string[];
}>;

export type RecognitionAiWindowEvidence = Readonly<{
  openingCandidateId: string;
  hostWallCandidateId: string;
  reasonCodes: readonly string[];
}>;

export type RecognitionAiClutterEvidence = Readonly<{
  wallCandidateId: string;
  reasonCodes: readonly string[];
}>;

export type RecognitionAiLocalEvidenceSnapshot = Readonly<{
  widthPx: number;
  heightPx: number;
  localDraftFingerprint: string;
  activeWallIds: readonly string[];
  planBounds: NormalizedBox | null;
  structuralMask: StructuralMaskView;
  doorEvidence: readonly RecognitionAiDoorEvidence[];
  windowEvidence: readonly RecognitionAiWindowEvidence[];
  clutterEvidence: readonly RecognitionAiClutterEvidence[];
}>;

export type RecognitionAiStructuralMaskTransfer = Readonly<{
  widthPx: number;
  heightPx: number;
  bits: Uint8Array;
}>;

export type RecognitionAiLocalEvidenceTransfer = Omit<
  RecognitionAiLocalEvidenceSnapshot,
  "structuralMask"
> & Readonly<{
  structuralMask: RecognitionAiStructuralMaskTransfer;
}>;

const evidenceByFingerprint = new Map<string, RecognitionAiLocalEvidenceSnapshot>();

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AiProposalValidationError(`${label} должен быть положительным целым числом.`);
  }
  return value;
}

function sortedUnique(values: readonly string[], label: string, maximum: number): string[] {
  if (values.length > maximum) {
    throw new AiProposalValidationError(`${label} превышает безопасный лимит ${maximum}.`);
  }
  const result = values.map((value) => {
    if (typeof value !== "string" || !value.trim()) {
      throw new AiProposalValidationError(`${label} содержит пустой идентификатор.`);
    }
    return value.trim();
  }).sort();
  if (new Set(result).size !== result.length) {
    throw new AiProposalValidationError(`${label} содержит повторяющиеся идентификаторы.`);
  }
  return result;
}

function validateReasonCodes(values: readonly string[], label: string): string[] {
  return sortedUnique(values, label, AI_LOCAL_EVIDENCE_MAX_REASON_CODES);
}

function validateBox(box: NormalizedBox | null): NormalizedBox | null {
  if (box === null) return null;
  const values = [box.x, box.y, box.width, box.height];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new AiProposalValidationError("Границы плана содержат неконечные значения.");
  }
  if (
    box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0
    || box.x + box.width > 1 + Number.EPSILON
    || box.y + box.height > 1 + Number.EPSILON
  ) {
    throw new AiProposalValidationError("Границы плана выходят за нормализованный растр.");
  }
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function knownById<T extends { readonly id: string }>(values: readonly T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function validateOpeningEvidence<T extends RecognitionAiDoorEvidence | RecognitionAiWindowEvidence>(
  values: readonly T[],
  kind: "door" | "window",
  openingsById: Map<string, RecognitionOpeningCandidate>,
  activeWallIds: Set<string>,
  label: string,
): T[] {
  if (values.length > AI_LOCAL_EVIDENCE_MAX_CATEGORY_ITEMS) {
    throw new AiProposalValidationError(`${label} превышает безопасный лимит.`);
  }
  return values.map((value) => {
    const opening = openingsById.get(value.openingCandidateId);
    if (!opening || opening.kind !== kind) {
      throw new AiProposalValidationError(`${label} ссылается на неизвестный ${kind} проём.`);
    }
    if (
      opening.hostWallCandidateId !== value.hostWallCandidateId
      || !activeWallIds.has(value.hostWallCandidateId)
    ) {
      throw new AiProposalValidationError(`${label} ссылается на неподтверждённую host wall.`);
    }
    return {
      ...value,
      reasonCodes: validateReasonCodes(value.reasonCodes, `${label}.reasonCodes`),
    };
  });
}

function validateClutterEvidence(
  values: readonly RecognitionAiClutterEvidence[],
  wallsById: Map<string, RecognitionWallCandidate>,
): RecognitionAiClutterEvidence[] {
  if (values.length > AI_LOCAL_EVIDENCE_MAX_CATEGORY_ITEMS) {
    throw new AiProposalValidationError("Clutter evidence превышает безопасный лимит.");
  }
  return values.map((value) => {
    const wall = wallsById.get(value.wallCandidateId);
    if (!wall || wall.conflict === null) {
      throw new AiProposalValidationError("Clutter evidence должен ссылаться на известный заблокированный wall candidate.");
    }
    return {
      wallCandidateId: value.wallCandidateId,
      reasonCodes: validateReasonCodes(value.reasonCodes, "Clutter evidence.reasonCodes"),
    };
  });
}

function validateSnapshot(
  draft: RecognitionDraft,
  snapshot: RecognitionAiLocalEvidenceSnapshot,
): RecognitionAiLocalEvidenceSnapshot {
  const validDraft = validateRecognitionDraft(draft);
  const widthPx = positiveInteger(snapshot.widthPx, "Ширина evidence snapshot");
  const heightPx = positiveInteger(snapshot.heightPx, "Высота evidence snapshot");
  if (widthPx * heightPx > AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS) {
    throw new AiProposalValidationError("Structural mask превышает безопасный pixel budget.");
  }
  if (
    snapshot.structuralMask.widthPx !== widthPx
    || snapshot.structuralMask.heightPx !== heightPx
  ) {
    throw new AiProposalValidationError("Размер structural mask не совпадает с evidence snapshot.");
  }

  const expectedActiveWallIds = validDraft.walls
    .filter((wall) => wall.conflict === null)
    .map((wall) => wall.id)
    .sort();
  const activeWallIds = sortedUnique(
    snapshot.activeWallIds,
    "Active wall IDs",
    AI_LOCAL_EVIDENCE_MAX_ACTIVE_WALLS,
  );
  if (
    activeWallIds.length !== expectedActiveWallIds.length
    || activeWallIds.some((id, index) => id !== expectedActiveWallIds[index])
  ) {
    throw new AiProposalValidationError("Active wall IDs не совпадают с активной локальной геометрией.");
  }

  const wallsById = knownById(validDraft.walls);
  const openingsById = knownById(validDraft.openings);
  const activeWallIdSet = new Set(activeWallIds);
  const fingerprint = createLocalDraftFingerprint(validDraft);
  if (snapshot.localDraftFingerprint && snapshot.localDraftFingerprint !== fingerprint) {
    throw new AiProposalValidationError("Evidence snapshot относится к другому локальному черновику.");
  }

  return {
    widthPx,
    heightPx,
    localDraftFingerprint: fingerprint,
    activeWallIds,
    planBounds: validateBox(snapshot.planBounds),
    structuralMask: snapshot.structuralMask,
    doorEvidence: validateOpeningEvidence(
      snapshot.doorEvidence,
      "door",
      openingsById,
      activeWallIdSet,
      "Door evidence",
    ),
    windowEvidence: validateOpeningEvidence(
      snapshot.windowEvidence,
      "window",
      openingsById,
      activeWallIdSet,
      "Window evidence",
    ),
    clutterEvidence: validateClutterEvidence(snapshot.clutterEvidence, wallsById),
  };
}

function remember(snapshot: RecognitionAiLocalEvidenceSnapshot): void {
  evidenceByFingerprint.delete(snapshot.localDraftFingerprint);
  evidenceByFingerprint.set(snapshot.localDraftFingerprint, snapshot);
  while (evidenceByFingerprint.size > AI_LOCAL_EVIDENCE_REGISTRY_LIMIT) {
    const oldest = evidenceByFingerprint.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    evidenceByFingerprint.delete(oldest);
  }
}

export function registerAiLocalEvidenceForDraft(
  draft: RecognitionDraft,
  evidence: RecognitionAiLocalEvidenceSnapshot,
): void {
  remember(validateSnapshot(draft, evidence));
}

export function peekAiLocalEvidenceForDraft(
  draft: RecognitionDraft,
): RecognitionAiLocalEvidenceSnapshot | null {
  const fingerprint = createLocalDraftFingerprint(draft);
  return evidenceByFingerprint.get(fingerprint) ?? null;
}

export function clearAiLocalEvidenceForDraft(draft: RecognitionDraft): void {
  evidenceByFingerprint.delete(createLocalDraftFingerprint(draft));
}

function maskPixelIndex(widthPx: number, x: number, y: number): number {
  return y * widthPx + x;
}

function bitValue(bits: Uint8Array, index: number): boolean {
  return (bits[index >>> 3]! & (1 << (index & 7))) !== 0;
}

export function createStructuralMaskTransfer(
  mask: StructuralMaskView,
): RecognitionAiStructuralMaskTransfer {
  const widthPx = positiveInteger(mask.widthPx, "Ширина structural mask");
  const heightPx = positiveInteger(mask.heightPx, "Высота structural mask");
  const pixelCount = widthPx * heightPx;
  if (pixelCount > AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS) {
    throw new AiProposalValidationError("Structural mask превышает безопасный pixel budget.");
  }
  const bits = new Uint8Array(Math.ceil(pixelCount / 8));
  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      if (!mask.isStructural(x, y)) continue;
      const index = maskPixelIndex(widthPx, x, y);
      bits[index >>> 3] |= 1 << (index & 7);
    }
  }
  return { widthPx, heightPx, bits };
}

export function createStructuralMaskView(
  transfer: RecognitionAiStructuralMaskTransfer,
): StructuralMaskView {
  const widthPx = positiveInteger(transfer.widthPx, "Ширина structural mask transfer");
  const heightPx = positiveInteger(transfer.heightPx, "Высота structural mask transfer");
  const pixelCount = widthPx * heightPx;
  if (pixelCount > AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS) {
    throw new AiProposalValidationError("Structural mask transfer превышает безопасный pixel budget.");
  }
  if (!(transfer.bits instanceof Uint8Array) || transfer.bits.byteLength !== Math.ceil(pixelCount / 8)) {
    throw new AiProposalValidationError("Structural mask transfer содержит некорректный bitset.");
  }
  const bits = new Uint8Array(transfer.bits);
  return {
    widthPx,
    heightPx,
    isStructural(x: number, y: number): boolean {
      const pixelX = Math.floor(x);
      const pixelY = Math.floor(y);
      if (pixelX < 0 || pixelY < 0 || pixelX >= widthPx || pixelY >= heightPx) return false;
      return bitValue(bits, maskPixelIndex(widthPx, pixelX, pixelY));
    },
  };
}

function resampledMaskView(
  source: StructuralMaskView,
  targetWidthPx: number,
  targetHeightPx: number,
): StructuralMaskView {
  return {
    widthPx: targetWidthPx,
    heightPx: targetHeightPx,
    isStructural(x: number, y: number): boolean {
      const sourceX = Math.min(
        source.widthPx - 1,
        Math.max(0, Math.floor((x + 0.5) * source.widthPx / targetWidthPx)),
      );
      const sourceY = Math.min(
        source.heightPx - 1,
        Math.max(0, Math.floor((y + 0.5) * source.heightPx / targetHeightPx)),
      );
      return source.isStructural(sourceX, sourceY);
    },
  };
}

function planBounds(
  activeWalls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): NormalizedBox | null {
  if (activeWalls.length === 0) return null;
  const xs = activeWalls.flatMap((wall) => [wall.start.x, wall.end.x]);
  const ys = activeWalls.flatMap((wall) => [wall.start.y, wall.end.y]);
  const minimumX = Math.max(0, Math.min(...xs));
  const maximumX = Math.min(1, Math.max(...xs));
  const minimumY = Math.max(0, Math.min(...ys));
  const maximumY = Math.min(1, Math.max(...ys));
  const minimumWidth = 1 / widthPx;
  const minimumHeight = 1 / heightPx;
  return {
    x: Math.min(minimumX, 1 - minimumWidth),
    y: Math.min(minimumY, 1 - minimumHeight),
    width: Math.min(1 - minimumX, Math.max(minimumWidth, maximumX - minimumX)),
    height: Math.min(1 - minimumY, Math.max(minimumHeight, maximumY - minimumY)),
  };
}

function openingEvidence(
  openings: readonly RecognitionOpeningCandidate[],
  kind: "door" | "window",
): readonly (RecognitionAiDoorEvidence | RecognitionAiWindowEvidence)[] {
  return openings
    .filter((opening) =>
      opening.kind === kind
      && opening.conflict === null
      && opening.hostWallCandidateId !== null)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, AI_LOCAL_EVIDENCE_MAX_CATEGORY_ITEMS)
    .map((opening) => ({
      openingCandidateId: opening.id,
      hostWallCandidateId: opening.hostWallCandidateId!,
      reasonCodes: [...opening.evidence.reasons]
        .sort()
        .slice(0, AI_LOCAL_EVIDENCE_MAX_REASON_CODES),
    }));
}

function clutterEvidence(
  walls: readonly RecognitionWallCandidate[],
): readonly RecognitionAiClutterEvidence[] {
  return walls
    .filter((wall) => wall.conflict !== null)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, AI_LOCAL_EVIDENCE_MAX_CATEGORY_ITEMS)
    .map((wall) => ({
      wallCandidateId: wall.id,
      reasonCodes: [...wall.evidence.reasons]
        .sort()
        .slice(0, AI_LOCAL_EVIDENCE_MAX_REASON_CODES),
    }));
}

export function materializePendingAiLocalEvidenceForDraft(
  draft: RecognitionDraft,
  widthPx: number,
  heightPx: number,
): RecognitionAiLocalEvidenceTransfer | null {
  const validDraft = validateRecognitionDraft(draft);
  const targetWidthPx = positiveInteger(widthPx, "Ширина source evidence");
  const targetHeightPx = positiveInteger(heightPx, "Высота source evidence");
  if (targetWidthPx * targetHeightPx > AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS) return null;
  const activeWalls = validDraft.walls.filter((wall) => wall.conflict === null);
  if (activeWalls.length > AI_LOCAL_EVIDENCE_MAX_ACTIVE_WALLS) return null;
  const pending = takePendingAiLocalEvidenceContext(activeWalls.map((wall) => wall.id));
  if (!pending) return null;
  const structuralMask = createStructuralMaskTransfer(resampledMaskView(
    pending.structuralMask,
    targetWidthPx,
    targetHeightPx,
  ));
  const localDraftFingerprint = createLocalDraftFingerprint(validDraft);
  return {
    widthPx: targetWidthPx,
    heightPx: targetHeightPx,
    localDraftFingerprint,
    activeWallIds: activeWalls.map((wall) => wall.id).sort(),
    planBounds: planBounds(activeWalls, targetWidthPx, targetHeightPx),
    structuralMask,
    doorEvidence: openingEvidence(validDraft.openings, "door") as readonly RecognitionAiDoorEvidence[],
    windowEvidence: openingEvidence(validDraft.openings, "window") as readonly RecognitionAiWindowEvidence[],
    clutterEvidence: clutterEvidence(validDraft.walls),
  };
}

export function inflateAiLocalEvidenceTransfer(
  transfer: RecognitionAiLocalEvidenceTransfer,
): RecognitionAiLocalEvidenceSnapshot {
  return {
    ...transfer,
    structuralMask: createStructuralMaskView(transfer.structuralMask),
  };
}
