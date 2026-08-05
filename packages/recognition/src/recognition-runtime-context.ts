import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

const structuralMasksByWall = new WeakMap<RecognitionWallCandidate, StructuralMaskView>();
const MAX_PENDING_AI_EVIDENCE_CONTEXTS = 8;
const MAX_PENDING_AI_EVIDENCE_MASK_PIXELS = 8_000_000;

export type PendingAiLocalEvidenceContext = Readonly<{
  activeWallIds: readonly string[];
  structuralMask: StructuralMaskView;
}>;

const pendingAiEvidenceByWallSignature = new Map<string, PendingAiLocalEvidenceContext>();

function matchingDimensions(
  mask: StructuralMaskView,
  widthPx: number,
  heightPx: number,
): boolean {
  return mask.widthPx === widthPx && mask.heightPx === heightPx;
}

function wallSignature(wallIds: readonly string[]): string {
  return [...wallIds].sort().join("\u001f");
}

function retainStructuralMask(mask: StructuralMaskView): StructuralMaskView | null {
  const widthPx = mask.widthPx;
  const heightPx = mask.heightPx;
  if (
    !Number.isInteger(widthPx)
    || !Number.isInteger(heightPx)
    || widthPx <= 0
    || heightPx <= 0
    || widthPx * heightPx > MAX_PENDING_AI_EVIDENCE_MASK_PIXELS
  ) {
    return null;
  }

  const bits = new Uint8Array(Math.ceil(widthPx * heightPx / 8));
  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      if (!mask.isStructural(x, y)) continue;
      const index = y * widthPx + x;
      bits[index >>> 3] |= 1 << (index & 7);
    }
  }

  return {
    widthPx,
    heightPx,
    isStructural(x: number, y: number): boolean {
      const pixelX = Math.floor(x);
      const pixelY = Math.floor(y);
      if (pixelX < 0 || pixelY < 0 || pixelX >= widthPx || pixelY >= heightPx) return false;
      const index = pixelY * widthPx + pixelX;
      return (bits[index >>> 3]! & (1 << (index & 7))) !== 0;
    },
  };
}

export function registerStructuralMaskForActiveWalls(
  wallCandidates: readonly RecognitionWallCandidate[],
  mask: StructuralMaskView,
): void {
  for (const candidate of wallCandidates) {
    if (candidate.conflict === null) structuralMasksByWall.set(candidate, mask);
  }
}

export function takeStructuralMaskForWalls(
  wallCandidates: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): StructuralMaskView | null {
  let resolved: StructuralMaskView | null = null;
  for (const candidate of wallCandidates) {
    const mask = structuralMasksByWall.get(candidate);
    if (mask && matchingDimensions(mask, widthPx, heightPx)) {
      resolved = mask;
      break;
    }
  }
  if (!resolved) return null;
  for (const candidate of wallCandidates) structuralMasksByWall.delete(candidate);
  return resolved;
}

export function registerPendingAiLocalEvidenceContext(
  wallCandidates: readonly RecognitionWallCandidate[],
  structuralMask: StructuralMaskView,
): void {
  const activeWallIds = wallCandidates
    .filter((wall) => wall.conflict === null)
    .map((wall) => wall.id)
    .sort();
  if (activeWallIds.length === 0) return;
  const retainedMask = retainStructuralMask(structuralMask);
  if (!retainedMask) return;
  const signature = wallSignature(activeWallIds);
  pendingAiEvidenceByWallSignature.delete(signature);
  pendingAiEvidenceByWallSignature.set(signature, { activeWallIds, structuralMask: retainedMask });
  while (pendingAiEvidenceByWallSignature.size > MAX_PENDING_AI_EVIDENCE_CONTEXTS) {
    const oldest = pendingAiEvidenceByWallSignature.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    pendingAiEvidenceByWallSignature.delete(oldest);
  }
}

export function takePendingAiLocalEvidenceContext(
  activeWallIds: readonly string[],
): PendingAiLocalEvidenceContext | null {
  const signature = wallSignature(activeWallIds);
  const pending = pendingAiEvidenceByWallSignature.get(signature) ?? null;
  if (pending) pendingAiEvidenceByWallSignature.delete(signature);
  return pending;
}
