import { beforeEach, describe, expect, it } from "vitest";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import {
  clearAiRejectedOpeningEvidenceForDraft,
  createRejectedOpeningEvidenceTransfer,
  registerAiRejectedOpeningEvidenceForDraft,
} from "./ai-rejected-opening-evidence";
import { AI_PROPOSAL_SCHEMA_VERSION, type AiProposalBatch } from "./ai-proposals";
import { sanitizeAiProposalBatch } from "./ai-proposal-sanity-runtime";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { RecognitionDraft } from "./model";
import type { OpeningHypothesisRejection } from "./opening-analysis";

const WIDTH = 1000;
const HEIGHT = 500;

function draft(): RecognitionDraft {
  return {
    id: "draft-window-batch",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [{
      id: "wall-window",
      start: { x: 0.1, y: 0.08 },
      end: { x: 0.9, y: 0.08 },
      estimatedThicknessPx: 20,
      confidence: "high",
      evidence: {
        localScore: 0.91,
        cloudScore: null,
        reasons: ["filled-wall-region-evidence", "exterior-boundary-host-bridge"],
      },
      origin: "local",
      conflict: null,
    }],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-window": "pending" },
    source: { local: true, cloud: false },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function rejectedWindow(): OpeningHypothesisRejection {
  return {
    candidateId: "local-rejected-window-1",
    hostWallCandidateId: "wall-window",
    code: "opening-end-margin",
    message: "Локальная оконная гипотеза не прошла строгий фильтр.",
    candidate: {
      id: "local-rejected-window-1",
      kind: "window",
      hostWallCandidateId: "wall-window",
      center: { x: 0.5, y: 0.08 },
      widthPx: 120,
      orientationDeg: 0,
      confidence: "low",
      evidence: {
        localScore: 0.66,
        cloudScore: null,
        reasons: ["wall-gap", "paired-window-rails", "paired-cross-lines"],
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
    activeWallIds: ["wall-window"],
    planBounds: { x: 0.1, y: 0.06, width: 0.8, height: 0.84 },
    structuralMask: {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural(x, y): boolean {
        return y >= 35 && y <= 45 && (x < 435 || x > 565);
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
    requestId: "request-window-batch",
    referenceRevision: localDraft.referenceRevision,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    proposals: [{
      id: "raw-window-1",
      kind: "opening-addition",
      openingKind: "window",
      center: { x: 0.5, y: 0.08 },
      widthNormalized: 0.12,
      orientationDeg: 0,
      hostWallHintIds: ["wall-window"],
      sourceRegion: { x: 0.43, y: 0.02, width: 0.14, height: 0.12 },
      modelConfidence: 0.96,
      reasonCodes: ["visible-gap", "parallel-window-rails", "exterior-boundary-context"],
    }],
    diagnostics: [],
  };
}

beforeEach(() => {
  clearAiRejectedOpeningEvidenceForDraft(draft());
});

describe("AI window batch sanitation", () => {
  it("delegates a locally evidenced exterior window without mutating the local Draft", () => {
    const localDraft = draft();
    const before = JSON.stringify(localDraft);
    registerAiRejectedOpeningEvidenceForDraft(localDraft, createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [rejectedWindow()],
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
    expect(result.sanitized).toMatchObject([{
      rawProposalId: "raw-window-1",
      kind: "window",
      state: "eligible",
      hostWallCandidateId: "wall-window",
      deterministicConfidence: "medium",
      geometry: {
        kind: "opening",
        center: { x: 0.5, y: 0.08 },
        widthNormalized: 0.12,
        orientationDeg: 0,
      },
    }]);
    expect(JSON.stringify(localDraft)).toBe(before);
  });
});
