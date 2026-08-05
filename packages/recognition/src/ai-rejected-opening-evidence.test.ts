import { describe, expect, it } from "vitest";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { RecognitionDraft } from "./model";
import type { OpeningHypothesisRejection } from "./opening-analysis";
import {
  AI_REJECTED_OPENING_EVIDENCE_MAX_ITEMS,
  createRejectedOpeningEvidenceTransfer,
  peekAiRejectedOpeningEvidenceForDraft,
  registerAiRejectedOpeningEvidenceForDraft,
} from "./ai-rejected-opening-evidence";

function draft(): RecognitionDraft {
  return {
    id: "draft-rejected-opening-evidence",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [{
      id: "wall-1",
      start: { x: 0.1, y: 0.5 },
      end: { x: 0.9, y: 0.5 },
      estimatedThicknessPx: 24,
      confidence: "high",
      evidence: { localScore: 0.91, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
      origin: "local",
      conflict: null,
    }],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending" },
    source: { local: true, cloud: false },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function rejection(id = "rejected-door-1"): OpeningHypothesisRejection {
  return {
    candidateId: id,
    hostWallCandidateId: "wall-1",
    code: "opening-end-margin",
    message: "Проём расположен слишком близко к окончанию стены.",
    candidate: {
      id,
      kind: "door",
      hostWallCandidateId: "wall-1",
      center: { x: 0.42, y: 0.5 },
      widthPx: 80,
      orientationDeg: 0,
      confidence: "low",
      evidence: {
        localScore: 0.63,
        cloudScore: null,
        reasons: ["door-leaf", "visible-gap"],
      },
      origin: "local",
      conflict: "invalid-host",
    },
  };
}

describe("rejected opening runtime evidence", () => {
  it("creates a bounded source-resolution transfer without private raster data", () => {
    const localDraft = draft();
    const transfer = createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [rejection()],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 1000,
      sourceHeightPx: 600,
    });

    expect(transfer).toEqual({
      localDraftFingerprint: createLocalDraftFingerprint(localDraft),
      widthPx: 1000,
      heightPx: 600,
      items: [{
        openingCandidateId: "rejected-door-1",
        kind: "door",
        hostWallCandidateId: "wall-1",
        center: { x: 0.42, y: 0.5 },
        widthPx: 160,
        orientationDeg: 0,
        rejectionCode: "opening-end-margin",
        reasonCodes: ["door-leaf", "visible-gap"],
      }],
    });
    expect(JSON.stringify(transfer)).not.toMatch(/data:image|base64|private-raster|authorization/i);
  });

  it("registers and resolves evidence only for the exact local Draft fingerprint", () => {
    const localDraft = draft();
    const transfer = createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [rejection()],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    });

    registerAiRejectedOpeningEvidenceForDraft(localDraft, transfer);
    expect(peekAiRejectedOpeningEvidenceForDraft(localDraft)).toEqual(transfer);
    expect(peekAiRejectedOpeningEvidenceForDraft({
      ...localDraft,
      walls: [{ ...localDraft.walls[0]!, end: { x: 0.88, y: 0.5 } }],
    })).toBeNull();
  });

  it("rejects unknown or blocked host references", () => {
    const localDraft = draft();
    expect(() => createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [{ ...rejection(), hostWallCandidateId: "unknown-wall" }],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    })).toThrow(/host wall/i);

    const blockedDraft: RecognitionDraft = {
      ...localDraft,
      walls: [{ ...localDraft.walls[0]!, conflict: "geometry-conflict" }],
    };
    expect(() => createRejectedOpeningEvidenceTransfer({
      localDraft: blockedDraft,
      rejections: [rejection()],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    })).toThrow(/host wall/i);
  });

  it("rejects duplicate IDs and over-budget evidence instead of truncating", () => {
    const localDraft = draft();
    expect(() => createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [rejection(), rejection()],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    })).toThrow(/повтор/i);
    expect(() => createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: Array.from(
        { length: AI_REJECTED_OPENING_EVIDENCE_MAX_ITEMS + 1 },
        (_, index) => rejection(`rejected-door-${index}`),
      ),
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    })).toThrow(/лимит/i);
  });

  it("rejects invalid geometry, rejection codes and a stale transfer identity", () => {
    const localDraft = draft();
    expect(() => createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [{
        ...rejection(),
        candidate: { ...rejection().candidate, widthPx: Number.NaN },
      }],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    })).toThrow();
    expect(() => createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [{ ...rejection(), code: "unsupported-code" as never }],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    })).toThrow();

    const transfer = createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [rejection()],
      analysisWidthPx: 500,
      analysisHeightPx: 300,
      sourceWidthPx: 500,
      sourceHeightPx: 300,
    });
    expect(() => registerAiRejectedOpeningEvidenceForDraft(localDraft, {
      ...transfer,
      localDraftFingerprint: `recognition-local-draft-v1:${"f".repeat(64)}`,
    })).toThrow(/fingerprint|черновик/i);
  });
});
