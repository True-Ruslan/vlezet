import { describe, expect, it } from "vitest";
import {
  AI_PROPOSAL_MAX_DIAGNOSTICS,
  AI_PROPOSAL_MAX_OPENINGS,
  AI_PROPOSAL_MAX_WALL_REVIEWS,
  AI_PROPOSAL_SCHEMA_VERSION,
  emptyAiProposalDraftState,
  validateAiProposalBatch,
  validateSanitizedRecognitionProposal,
} from "./ai-proposals";
import { validateRecognitionDraft } from "./model";

const fingerprint = "a".repeat(64);

const validDoorProposal = {
  id: "raw-door-1",
  kind: "opening-addition",
  openingKind: "door",
  center: { x: 0.42, y: 0.58 },
  widthNormalized: 0.08,
  orientationDeg: 90,
  hostWallHintIds: ["wall-1"],
  sourceRegion: { x: 0.37, y: 0.52, width: 0.1, height: 0.12 },
  modelConfidence: 0.84,
  reasonCodes: ["visible-gap", "door-leaf"],
} as const;

const validWallReviewProposal = {
  id: "raw-review-1",
  kind: "local-wall-review",
  targetWallCandidateId: "wall-clutter-1",
  recommendation: "likely-clutter",
  sourceRegion: { x: 0.68, y: 0.44, width: 0.08, height: 0.08 },
  modelConfidence: 0.77,
  reasonCodes: ["sanitary-symbol-overlap", "weak-structural-mask-support"],
} as const;

const validStage1Batch = {
  schemaVersion: "recognition-ai-proposals-v1",
  requestId: "request-1",
  referenceRevision: "revision-1",
  localDraftFingerprint: fingerprint,
  proposals: [validDoorProposal, validWallReviewProposal],
  diagnostics: [],
} as const;

function oldDraftFixture(): Record<string, unknown> {
  return {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [
      {
        id: "wall-1",
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.9, y: 0.2 },
        estimatedThicknessPx: 18,
        confidence: "high",
        evidence: { localScore: 0.94, cloudScore: null, reasons: ["parallel-edges"] },
        origin: "local",
        conflict: null,
      },
    ],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending" },
    source: { local: true, cloud: false },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

describe("Stage 1 AI proposal contracts", () => {
  it("publishes immutable Stage 1 schema and budget constants", () => {
    expect(AI_PROPOSAL_SCHEMA_VERSION).toBe("recognition-ai-proposals-v1");
    expect(AI_PROPOSAL_MAX_OPENINGS).toBe(12);
    expect(AI_PROPOSAL_MAX_WALL_REVIEWS).toBe(12);
    expect(AI_PROPOSAL_MAX_DIAGNOSTICS).toBe(20);
  });

  it("accepts a valid Stage 1 batch without changing its semantic data", () => {
    expect(validateAiProposalBatch(validStage1Batch)).toEqual(validStage1Batch);
  });

  it("rejects unsupported schema versions", () => {
    expect(() => validateAiProposalBatch({ ...validStage1Batch, schemaVersion: "recognition-ai-proposals-v2" })).toThrow();
  });

  it("rejects duplicate proposal ids", () => {
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      proposals: [validDoorProposal, { ...validWallReviewProposal, id: validDoorProposal.id }],
    })).toThrow();
  });

  it("rejects non-finite and out-of-range geometry", () => {
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      proposals: [{ ...validDoorProposal, center: { x: Number.NaN, y: 0.5 } }],
    })).toThrow();
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      proposals: [{ ...validDoorProposal, sourceRegion: { x: 0.95, y: 0.2, width: 0.1, height: 0.1 } }],
    })).toThrow();
  });

  it("rejects unknown reason codes", () => {
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      proposals: [{ ...validDoorProposal, reasonCodes: ["model-says-so"] }],
    })).toThrow();
  });

  it("rejects Stage 2 thin-wall proposals in Stage 1", () => {
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      proposals: [{
        id: "raw-thin-wall-1",
        kind: "thin-wall-addition",
        start: { x: 0.1, y: 0.1 },
        end: { x: 0.4, y: 0.1 },
        estimatedThicknessNormalized: 0.01,
        wallRoleHint: "balcony-boundary",
        endpointAnchorHintIds: ["wall-1"],
        sourceRegion: { x: 0.08, y: 0.08, width: 0.34, height: 0.04 },
        modelConfidence: 0.9,
        reasonCodes: ["visible-thin-wall"],
      }],
    })).toThrow();
  });

  it("enforces category and diagnostic budgets without truncation", () => {
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      proposals: Array.from({ length: AI_PROPOSAL_MAX_OPENINGS + 1 }, (_, index) => ({
        ...validDoorProposal,
        id: `door-${index}`,
      })),
    })).toThrow();
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      proposals: Array.from({ length: AI_PROPOSAL_MAX_WALL_REVIEWS + 1 }, (_, index) => ({
        ...validWallReviewProposal,
        id: `review-${index}`,
        targetWallCandidateId: `wall-${index}`,
      })),
    })).toThrow();
    expect(() => validateAiProposalBatch({
      ...validStage1Batch,
      diagnostics: Array.from({ length: AI_PROPOSAL_MAX_DIAGNOSTICS + 1 }, (_, index) => ({
        code: `diagnostic-${index}`,
        severity: "warning",
        message: "bounded diagnostic",
      })),
    })).toThrow();
  });

  it("validates eligible sanitized openings but never permits high deterministic confidence", () => {
    const sanitized = {
      id: "proposal-door-1",
      rawProposalId: "raw-door-1",
      kind: "door",
      state: "eligible",
      geometry: {
        kind: "opening",
        center: { x: 0.42, y: 0.58 },
        widthNormalized: 0.08,
        orientationDeg: 90,
      },
      targetLocalCandidateId: null,
      hostWallCandidateId: "wall-1",
      provider: {
        providerId: "openrouter",
        modelId: "provider/model",
        requestId: "request-1",
      },
      modelConfidence: 0.84,
      deterministicConfidence: "medium",
      sourceRegion: { x: 0.37, y: 0.52, width: 0.1, height: 0.12 },
      evidence: {
        providerReasons: ["visible-gap", "door-leaf"],
        validatorReasons: ["host-wall-validated", "opening-span-validated"],
      },
      localDraftFingerprint: fingerprint,
    } as const;

    expect(validateSanitizedRecognitionProposal(sanitized)).toEqual(sanitized);
    expect(() => validateSanitizedRecognitionProposal({
      ...sanitized,
      deterministicConfidence: "high",
    })).toThrow();
  });

  it("migrates old Drafts only when the complete proposal state is absent", () => {
    expect(validateRecognitionDraft(oldDraftFixture())).toMatchObject({
      aiProposals: [],
      proposalDecisions: {},
      aiProposalMetadata: null,
    });
    expect(emptyAiProposalDraftState()).toEqual({
      aiProposals: [],
      proposalDecisions: {},
      aiProposalMetadata: null,
    });
  });

  it("rejects partially supplied proposal state and unknown proposal decisions", () => {
    const oldDraft = oldDraftFixture();
    expect(() => validateRecognitionDraft({ ...oldDraft, aiProposals: [] })).toThrow();
    expect(() => validateRecognitionDraft({
      ...oldDraft,
      aiProposals: [],
      proposalDecisions: { ghost: "accepted" },
      aiProposalMetadata: null,
    })).toThrow();
  });
});
