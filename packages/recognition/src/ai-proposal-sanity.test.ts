import { describe, expect, it } from "vitest";
import {
  AI_PROPOSAL_MAX_DIAGNOSTICS,
  AI_PROPOSAL_MAX_OPENINGS,
  AI_PROPOSAL_MAX_WALL_REVIEWS,
  AI_PROPOSAL_SCHEMA_VERSION,
  type AiProposalBatch,
} from "./ai-proposals";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import type { RecognitionDraft } from "./model";
import { sanitizeAiProposalBatch } from "./ai-proposal-sanity";

function localDraft(): RecognitionDraft {
  return {
    id: "draft-task-7",
    projectId: "project-task-7",
    referenceAssetId: "asset-task-7",
    referenceRevision: "revision-task-7",
    engineVersion: "5",
    status: "local-complete",
    walls: [{
      id: "wall-1",
      start: { x: 0.1, y: 0.25 },
      end: { x: 0.9, y: 0.25 },
      estimatedThicknessPx: 24,
      confidence: "high",
      evidence: {
        localScore: 0.92,
        cloudScore: null,
        reasons: ["filled-wall-region-evidence"],
      },
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

function localEvidence(draft: RecognitionDraft): RecognitionAiLocalEvidenceSnapshot {
  const fingerprint = createLocalDraftFingerprint(draft);
  return {
    widthPx: 100,
    heightPx: 80,
    localDraftFingerprint: fingerprint,
    activeWallIds: ["wall-1"],
    planBounds: null,
    structuralMask: {
      widthPx: 100,
      heightPx: 80,
      isStructural: () => false,
    },
    doorEvidence: [],
    windowEvidence: [],
    clutterEvidence: [],
  };
}

const openingProposal = {
  id: "raw-door-1",
  kind: "opening-addition",
  openingKind: "door",
  center: { x: 0.45, y: 0.25 },
  widthNormalized: 0.08,
  orientationDeg: 0,
  hostWallHintIds: ["wall-1"],
  sourceRegion: { x: 0.4, y: 0.2, width: 0.1, height: 0.1 },
  modelConfidence: 0.86,
  reasonCodes: ["visible-gap", "door-leaf"],
} as const;

const wallReviewProposal = {
  id: "raw-review-1",
  kind: "local-wall-review",
  targetWallCandidateId: "wall-1",
  recommendation: "likely-clutter",
  sourceRegion: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 },
  modelConfidence: 0.72,
  reasonCodes: ["weak-structural-mask-support"],
} as const;

function batch(draft: RecognitionDraft): AiProposalBatch {
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId: "request-task-7",
    referenceRevision: draft.referenceRevision,
    localDraftFingerprint: createLocalDraftFingerprint(draft),
    proposals: [openingProposal, wallReviewProposal],
    diagnostics: [],
  };
}

function sanitize(inputBatch: AiProposalBatch, draft = localDraft()) {
  return sanitizeAiProposalBatch({
    batch: inputBatch,
    expectedIdentity: {
      requestId: "request-task-7",
      referenceRevision: draft.referenceRevision,
      localDraftFingerprint: createLocalDraftFingerprint(draft),
    },
    provider: {
      providerId: "openrouter-direct",
      modelId: "provider/model",
      requestId: "request-task-7",
    },
    localDraft: draft,
    localEvidence: localEvidence(draft),
  });
}

describe("AI proposal batch sanitation", () => {
  it("keeps structurally valid proposals separate and blocked until category sanitizers authorize them", () => {
    const draft = localDraft();
    const result = sanitize(batch(draft), draft);

    expect(result.diagnostics).toEqual([]);
    expect(result.sanitized).toHaveLength(2);
    expect(result.sanitized.map(({ rawProposalId, state }) => [rawProposalId, state])).toEqual([
      ["raw-door-1", "blocked"],
      ["raw-review-1", "blocked"],
    ]);
    expect(result.sanitized[0]?.evidence.validatorReasons).toContain("opening-sanitizer-pending");
    expect(result.sanitized[1]?.evidence.validatorReasons).toContain("wall-review-sanitizer-pending");
    expect(result.sanitized.every(({ geometry }) => geometry === null)).toBe(true);
  });

  it.each([
    ["schema", (value: AiProposalBatch) => ({ ...value, schemaVersion: "recognition-ai-proposals-v2" })],
    ["request", (value: AiProposalBatch) => ({ ...value, requestId: "other-request" })],
    ["revision", (value: AiProposalBatch) => ({ ...value, referenceRevision: "other-revision" })],
    ["fingerprint", (value: AiProposalBatch) => ({ ...value, localDraftFingerprint: `recognition-local-draft-v1:${"f".repeat(64)}` })],
  ])("rejects the whole batch on %s identity mismatch", (_label, mutate) => {
    const draft = localDraft();
    const result = sanitize(mutate(batch(draft)) as AiProposalBatch, draft);

    expect(result.sanitized).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "ai-proposal-batch-rejected",
      severity: "error",
      candidateId: null,
    });
  });

  it("rejects duplicate proposal ids without silently retaining one", () => {
    const draft = localDraft();
    const value = batch(draft);
    const result = sanitize({
      ...value,
      proposals: [openingProposal, { ...wallReviewProposal, id: openingProposal.id }],
    }, draft);

    expect(result.sanitized).toEqual([]);
    expect(result.diagnostics[0]?.message).toMatch(/повтор/i);
  });

  it("rejects opening, wall-review and diagnostic overload without truncation", () => {
    const draft = localDraft();
    const value = batch(draft);
    const overloaded = [
      {
        ...value,
        proposals: Array.from({ length: AI_PROPOSAL_MAX_OPENINGS + 1 }, (_, index) => ({
          ...openingProposal,
          id: `opening-${index}`,
        })),
      },
      {
        ...value,
        proposals: Array.from({ length: AI_PROPOSAL_MAX_WALL_REVIEWS + 1 }, (_, index) => ({
          ...wallReviewProposal,
          id: `review-${index}`,
        })),
      },
      {
        ...value,
        diagnostics: Array.from({ length: AI_PROPOSAL_MAX_DIAGNOSTICS + 1 }, (_, index) => ({
          code: `diagnostic-${index}`,
          severity: "warning" as const,
          message: "bounded",
        })),
      },
    ];

    for (const candidate of overloaded) {
      const result = sanitize(candidate, draft);
      expect(result.sanitized).toEqual([]);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.message).toMatch(/лимит|превыш/i);
    }
  });

  it("rejects unsupported proposal types and structurally invalid top-level data", () => {
    const draft = localDraft();
    const value = batch(draft);
    const unsupported = sanitize({
      ...value,
      proposals: [{ id: "thin-wall", kind: "thin-wall-addition" } as never],
    }, draft);
    const invalidTopLevel = sanitize({
      ...value,
      proposals: null as never,
    }, draft);

    expect(unsupported.sanitized).toEqual([]);
    expect(invalidTopLevel.sanitized).toEqual([]);
    expect(unsupported.diagnostics[0]?.code).toBe("ai-proposal-batch-rejected");
    expect(invalidTopLevel.diagnostics[0]?.code).toBe("ai-proposal-batch-rejected");
  });

  it("blocks one semantic local-reference failure without discarding unrelated proposals", () => {
    const draft = localDraft();
    const value = batch(draft);
    const result = sanitize({
      ...value,
      proposals: [
        { ...openingProposal, id: "bad-host", hostWallHintIds: ["unknown-wall"] },
        wallReviewProposal,
      ],
    }, draft);

    expect(result.sanitized).toHaveLength(2);
    expect(result.sanitized.find(({ rawProposalId }) => rawProposalId === "bad-host")).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["unknown-host-wall-hint"] },
    });
    expect(result.sanitized.find(({ rawProposalId }) => rawProposalId === wallReviewProposal.id)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["wall-review-sanitizer-pending"] },
    });
  });

  it("rejects stale local evidence and provider request identity", () => {
    const draft = localDraft();
    const value = batch(draft);
    const staleEvidence = {
      ...localEvidence(draft),
      localDraftFingerprint: `recognition-local-draft-v1:${"e".repeat(64)}`,
    };
    const staleEvidenceResult = sanitizeAiProposalBatch({
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
      localDraft: draft,
      localEvidence: staleEvidence,
    });
    const providerMismatch = sanitizeAiProposalBatch({
      batch: value,
      expectedIdentity: {
        requestId: value.requestId,
        referenceRevision: value.referenceRevision,
        localDraftFingerprint: value.localDraftFingerprint,
      },
      provider: {
        providerId: "openrouter-direct",
        modelId: "provider/model",
        requestId: "other-request",
      },
      localDraft: draft,
      localEvidence: localEvidence(draft),
    });

    expect(staleEvidenceResult.sanitized).toEqual([]);
    expect(providerMismatch.sanitized).toEqual([]);
    expect(staleEvidenceResult.diagnostics[0]?.code).toBe("ai-proposal-batch-rejected");
    expect(providerMismatch.diagnostics[0]?.code).toBe("ai-proposal-batch-rejected");
  });
});
