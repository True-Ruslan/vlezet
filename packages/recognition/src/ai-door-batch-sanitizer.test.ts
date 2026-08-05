import { beforeEach, describe, expect, it } from "vitest";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import {
  clearAiRejectedOpeningEvidenceForDraft,
  createRejectedOpeningEvidenceTransfer,
  registerAiRejectedOpeningEvidenceForDraft,
} from "./ai-rejected-opening-evidence";
import {
  AI_PROPOSAL_SCHEMA_VERSION,
  type AiProposalBatch,
} from "./ai-proposals";
import { sanitizeAiProposalBatch } from "./ai-proposal-sanity-runtime";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { RecognitionDraft } from "./model";
import type { OpeningHypothesisRejection } from "./opening-analysis";

const WIDTH = 1000;
const HEIGHT = 500;

function draft(): RecognitionDraft {
  return {
    id: "draft-door-batch",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [{
      id: "wall-1",
      start: { x: 0.1, y: 0.5 },
      end: { x: 0.9, y: 0.5 },
      estimatedThicknessPx: 20,
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

function rejection(): OpeningHypothesisRejection {
  return {
    candidateId: "local-rejected-door-1",
    hostWallCandidateId: "wall-1",
    code: "opening-end-margin",
    message: "Локальная гипотеза не прошла строгий фильтр.",
    candidate: {
      id: "local-rejected-door-1",
      kind: "door",
      hostWallCandidateId: "wall-1",
      center: { x: 0.5, y: 0.5 },
      widthPx: 100,
      orientationDeg: 0,
      confidence: "low",
      evidence: {
        localScore: 0.64,
        cloudScore: null,
        reasons: ["door-leaf-anchored", "wall-gap"],
      },
      origin: "local",
      conflict: "invalid-host",
    },
  };
}

function evidence(localDraft: RecognitionDraft): RecognitionAiLocalEvidenceSnapshot {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    activeWallIds: ["wall-1"],
    planBounds: { x: 0.1, y: 0.45, width: 0.8, height: 0.1 },
    structuralMask: {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural(x, y): boolean {
        return y >= 245 && y <= 255 && (x < 445 || x > 555);
      },
    },
    doorEvidence: [],
    windowEvidence: [],
    clutterEvidence: [],
  };
}

function batch(localDraft: RecognitionDraft): AiProposalBatch {
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId: "request-door-batch",
    referenceRevision: localDraft.referenceRevision,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    proposals: [{
      id: "raw-door-1",
      kind: "opening-addition",
      openingKind: "door",
      center: { x: 0.5, y: 0.5 },
      widthNormalized: 0.1,
      orientationDeg: 0,
      hostWallHintIds: ["wall-1"],
      sourceRegion: { x: 0.44, y: 0.42, width: 0.12, height: 0.16 },
      modelConfidence: 0.94,
      reasonCodes: ["visible-gap", "door-leaf"],
    }, {
      id: "raw-window-1",
      kind: "opening-addition",
      openingKind: "window",
      center: { x: 0.7, y: 0.5 },
      widthNormalized: 0.12,
      orientationDeg: 0,
      hostWallHintIds: ["wall-1"],
      sourceRegion: { x: 0.63, y: 0.42, width: 0.14, height: 0.16 },
      modelConfidence: 0.9,
      reasonCodes: ["visible-gap", "paired-rails"],
    }],
    diagnostics: [],
  };
}

beforeEach(() => {
  clearAiRejectedOpeningEvidenceForDraft(draft());
});

describe("AI door batch sanitation", () => {
  it("delegates a valid door while keeping unsupported categories blocked and local Draft immutable", () => {
    const localDraft = draft();
    const before = JSON.stringify(localDraft);
    registerAiRejectedOpeningEvidenceForDraft(localDraft, createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [rejection()],
      analysisWidthPx: WIDTH,
      analysisHeightPx: HEIGHT,
      sourceWidthPx: WIDTH,
      sourceHeightPx: HEIGHT,
    }));
    const value = batch(localDraft);

    const result = sanitizeAiProposalBatch({
      batch: value,
      expectedIdentity: {
        requestId: value.requestId,
        referenceRevision: value.referenceRevision,
        localDraftFingerprint: value.localDraftFingerprint,
      },
      provider: {
        providerId: "openrouter-direct",
        modelId: "provider/model",
        requestId: value.requestId,
      },
      localDraft,
      localEvidence: evidence(localDraft),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.sanitized).toHaveLength(2);
    expect(result.sanitized[0]).toMatchObject({
      rawProposalId: "raw-door-1",
      kind: "door",
      state: "eligible",
      hostWallCandidateId: "wall-1",
      deterministicConfidence: "medium",
    });
    expect(result.sanitized[1]).toMatchObject({
      rawProposalId: "raw-window-1",
      kind: "window",
      state: "blocked",
      evidence: { validatorReasons: ["opening-sanitizer-pending"] },
    });
    expect(JSON.stringify(localDraft)).toBe(before);
  });

  it("preserves whole-batch rejection before category delegation", () => {
    const localDraft = draft();
    const value = batch(localDraft);
    const result = sanitizeAiProposalBatch({
      batch: { ...value, requestId: "stale-request" },
      expectedIdentity: {
        requestId: value.requestId,
        referenceRevision: value.referenceRevision,
        localDraftFingerprint: value.localDraftFingerprint,
      },
      provider: {
        providerId: "openrouter-direct",
        modelId: "provider/model",
        requestId: value.requestId,
      },
      localDraft,
      localEvidence: evidence(localDraft),
    });

    expect(result.sanitized).toEqual([]);
    expect(result.diagnostics).toMatchObject([{ code: "ai-proposal-batch-rejected", severity: "error" }]);
  });
});
