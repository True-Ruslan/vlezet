import { describe, expect, it } from "vitest";
import {
  AI_LOCAL_EVIDENCE_MAX_ACTIVE_WALLS,
  AI_LOCAL_EVIDENCE_MAX_CATEGORY_ITEMS,
  clearAiLocalEvidenceForDraft,
  createStructuralMaskTransfer,
  createStructuralMaskView,
  peekAiLocalEvidenceForDraft,
  registerAiLocalEvidenceForDraft,
  type RecognitionAiLocalEvidenceSnapshot,
  type ValidatedRecognitionDraft,
} from "./index";

const WIDTH = 100;
const HEIGHT = 80;
const NOW = "2026-08-05T00:00:00.000Z";

function draft(overrides: Partial<ValidatedRecognitionDraft> = {}): ValidatedRecognitionDraft {
  return {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [
      {
        id: "wall-active",
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.9, y: 0.2 },
        estimatedThicknessPx: 10,
        confidence: "high",
        evidence: { localScore: 0.9, cloudScore: null, reasons: ["structural"] },
        origin: "local",
        conflict: null,
      },
      {
        id: "wall-blocked",
        start: { x: 0.4, y: 0.4 },
        end: { x: 0.5, y: 0.4 },
        estimatedThicknessPx: 8,
        confidence: "low",
        evidence: { localScore: 0.3, cloudScore: null, reasons: ["sanitary-symbol-overlap"] },
        origin: "local",
        conflict: "unsupported",
      },
    ],
    openings: [{
      id: "door-1",
      kind: "door",
      hostWallCandidateId: "wall-active",
      center: { x: 0.5, y: 0.2 },
      widthPx: 12,
      orientationDeg: 0,
      confidence: "medium",
      evidence: { localScore: 0.7, cloudScore: null, reasons: ["door-leaf"] },
      origin: "local",
      conflict: null,
    }],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-active": "pending", "wall-blocked": "rejected", "door-1": "pending" },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mask() {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x: number, y: number): boolean {
      return y >= 15 && y <= 17 && x >= 10 && x <= 90;
    },
  };
}

function snapshot(overrides: Partial<RecognitionAiLocalEvidenceSnapshot> = {}): RecognitionAiLocalEvidenceSnapshot {
  const localDraft = draft();
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    localDraftFingerprint: "",
    activeWallIds: ["wall-active"],
    planBounds: { x: 0.1, y: 0.2, width: 0.8, height: 0.01 },
    structuralMask: mask(),
    doorEvidence: [{
      openingCandidateId: "door-1",
      hostWallCandidateId: "wall-active",
      reasonCodes: ["door-leaf"],
    }],
    windowEvidence: [],
    clutterEvidence: [{
      wallCandidateId: "wall-blocked",
      reasonCodes: ["sanitary-symbol-overlap"],
    }],
    ...overrides,
  };
}

describe("bounded runtime-only local AI evidence", () => {
  it("registers a validated snapshot, fills the fingerprint and peek is non-consuming", () => {
    const localDraft = draft();
    registerAiLocalEvidenceForDraft(localDraft, snapshot());

    const first = peekAiLocalEvidenceForDraft(localDraft);
    const second = peekAiLocalEvidenceForDraft(localDraft);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(first?.localDraftFingerprint).toMatch(/^recognition-local-draft-v1:[a-f0-9]{64}$/);
    expect(first?.activeWallIds).toEqual(["wall-active"]);
  });

  it("rejects blocked active IDs, mask dimension mismatches and unknown evidence references", () => {
    const localDraft = draft();
    expect(() => registerAiLocalEvidenceForDraft(localDraft, snapshot({
      activeWallIds: ["wall-blocked"],
    }))).toThrow();
    expect(() => registerAiLocalEvidenceForDraft(localDraft, snapshot({
      structuralMask: { ...mask(), widthPx: WIDTH + 1 },
    }))).toThrow();
    expect(() => registerAiLocalEvidenceForDraft(localDraft, snapshot({
      doorEvidence: [{ openingCandidateId: "missing", hostWallCandidateId: "wall-active", reasonCodes: [] }],
    }))).toThrow();
    expect(() => registerAiLocalEvidenceForDraft(localDraft, snapshot({
      clutterEvidence: [{ wallCandidateId: "missing", reasonCodes: [] }],
    }))).toThrow();
  });

  it("rejects category and active-wall budget overflow", () => {
    const localDraft = draft();
    expect(() => registerAiLocalEvidenceForDraft(localDraft, snapshot({
      activeWallIds: Array.from({ length: AI_LOCAL_EVIDENCE_MAX_ACTIVE_WALLS + 1 }, (_, index) => `wall-${index}`),
    }))).toThrow();
    expect(() => registerAiLocalEvidenceForDraft(localDraft, snapshot({
      doorEvidence: Array.from({ length: AI_LOCAL_EVIDENCE_MAX_CATEGORY_ITEMS + 1 }, () => ({
        openingCandidateId: "door-1",
        hostWallCandidateId: "wall-active",
        reasonCodes: ["door-leaf"],
      })),
    }))).toThrow();
  });

  it("returns null for a changed Draft fingerprint and clear removes the exact snapshot", () => {
    const localDraft = draft();
    registerAiLocalEvidenceForDraft(localDraft, snapshot());
    const changed = draft({
      walls: localDraft.walls.map((wall) => wall.id === "wall-active"
        ? { ...wall, end: { x: 0.85, y: 0.2 } }
        : wall),
    });
    expect(peekAiLocalEvidenceForDraft(changed)).toBeNull();
    clearAiLocalEvidenceForDraft(localDraft);
    expect(peekAiLocalEvidenceForDraft(localDraft)).toBeNull();
  });

  it("round-trips a bounded structural mask transfer without raw raster pixels", () => {
    const transfer = createStructuralMaskTransfer(mask());
    expect(transfer.widthPx).toBe(WIDTH);
    expect(transfer.heightPx).toBe(HEIGHT);
    expect(transfer.bits).toBeInstanceOf(Uint8Array);
    expect(transfer.bits.byteLength).toBe(Math.ceil(WIDTH * HEIGHT / 8));

    const restored = createStructuralMaskView(transfer);
    expect(restored.isStructural(20, 16)).toBe(true);
    expect(restored.isStructural(20, 30)).toBe(false);
  });
});
