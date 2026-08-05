import { describe, expect, it } from "vitest";
import {
  AI_PROPOSAL_SCHEMA_VERSION,
  type RecognitionAiProposalMetadata,
  type SanitizedRecognitionProposal,
} from "./ai-proposals";
import { reconcileAiProposalBatch } from "./ai-proposal-reconcile";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import {
  validateRecognitionDraft,
  type ValidatedRecognitionDraft,
} from "./model";

const CREATED_AT = "2026-08-05T00:00:00.000Z";
const FIRST_COMPLETED_AT = "2026-08-05T01:00:00.000Z";
const FIRST_RECONCILED_AT = "2026-08-05T01:01:00.000Z";
const SECOND_COMPLETED_AT = "2026-08-05T02:00:00.000Z";
const SECOND_RECONCILED_AT = "2026-08-05T02:01:00.000Z";

function localDraft(overrides: Partial<ValidatedRecognitionDraft> = {}): ValidatedRecognitionDraft {
  return validateRecognitionDraft({
    id: "draft-reconcile-ai",
    projectId: "project-reconcile-ai",
    referenceAssetId: "asset-reconcile-ai",
    referenceRevision: "revision-reconcile-ai",
    engineVersion: "5",
    status: "local-complete",
    walls: [
      {
        id: "wall-1",
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.9, y: 0.2 },
        estimatedThicknessPx: 18,
        confidence: "high",
        evidence: {
          localScore: 0.94,
          cloudScore: null,
          reasons: ["parallel-edges", "filled-wall-region-evidence"],
        },
        origin: "local",
        conflict: null,
      },
      {
        id: "wall-clutter",
        start: { x: 0.68, y: 0.44 },
        end: { x: 0.74, y: 0.44 },
        estimatedThicknessPx: 14,
        confidence: "low",
        evidence: {
          localScore: 0.28,
          cloudScore: null,
          reasons: ["structural-clutter-veto", "sanitary-symbol-overlap"],
        },
        origin: "local",
        conflict: "unsupported",
      },
    ],
    openings: [
      {
        id: "opening-local-1",
        kind: "door",
        hostWallCandidateId: "wall-1",
        center: { x: 0.32, y: 0.2 },
        widthPx: 82,
        orientationDeg: 0,
        confidence: "medium",
        evidence: {
          localScore: 0.76,
          cloudScore: null,
          reasons: ["wall-gap", "host-wall-validated"],
        },
        origin: "local",
        conflict: null,
      },
    ],
    roomLabels: [],
    diagnostics: [
      {
        code: "local-ready",
        severity: "info",
        message: "Локальное распознавание завершено.",
        candidateId: null,
      },
    ],
    decisions: {
      "wall-1": "accepted",
      "wall-clutter": "rejected",
      "opening-local-1": "pending",
    },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  });
}

function metadata(
  draft: ValidatedRecognitionDraft,
  requestId = "request-1",
  completedAt = FIRST_COMPLETED_AT,
): RecognitionAiProposalMetadata {
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId,
    referenceRevision: draft.referenceRevision,
    localDraftFingerprint: createLocalDraftFingerprint(draft),
    providerId: "openrouter-direct",
    modelId: "provider/model",
    completedAt,
  };
}

function provider(requestId: string) {
  return {
    providerId: "openrouter-direct",
    modelId: "provider/model",
    requestId,
  } as const;
}

function eligibleDoor(
  draft: ValidatedRecognitionDraft,
  requestId = "request-1",
  id = "ai-proposal:request-1:door-z",
): SanitizedRecognitionProposal {
  return {
    id,
    rawProposalId: "door-z",
    kind: "door",
    state: "eligible",
    geometry: {
      kind: "opening",
      center: { x: 0.52, y: 0.2 },
      widthNormalized: 0.08,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: "wall-1",
    provider: provider(requestId),
    modelConfidence: 0.91,
    deterministicConfidence: "medium",
    sourceRegion: { x: 0.47, y: 0.16, width: 0.1, height: 0.08 },
    evidence: {
      providerReasons: ["visible-gap", "door-leaf"],
      validatorReasons: ["host-wall-validated", "opening-span-validated"],
    },
    localDraftFingerprint: createLocalDraftFingerprint(draft),
  };
}

function blockedWindow(
  draft: ValidatedRecognitionDraft,
  requestId = "request-1",
  id = "ai-proposal:request-1:window-a",
): SanitizedRecognitionProposal {
  return {
    id,
    rawProposalId: "window-a",
    kind: "window",
    state: "blocked",
    geometry: {
      kind: "opening",
      center: { x: 0.72, y: 0.2 },
      widthNormalized: 0.12,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: null,
    provider: provider(requestId),
    modelConfidence: 0.88,
    deterministicConfidence: "low",
    sourceRegion: { x: 0.65, y: 0.16, width: 0.14, height: 0.08 },
    evidence: {
      providerReasons: ["visible-gap"],
      validatorReasons: ["provider-window-evidence-incomplete"],
    },
    localDraftFingerprint: createLocalDraftFingerprint(draft),
  };
}

function duplicateWallReview(
  draft: ValidatedRecognitionDraft,
  requestId = "request-1",
  id = "ai-proposal:request-1:review-m",
): SanitizedRecognitionProposal {
  return {
    id,
    rawProposalId: "review-m",
    kind: "local-wall-review",
    state: "duplicate",
    geometry: null,
    targetLocalCandidateId: "wall-clutter",
    hostWallCandidateId: null,
    provider: provider(requestId),
    modelConfidence: 0.79,
    deterministicConfidence: "low",
    sourceRegion: { x: 0.67, y: 0.41, width: 0.09, height: 0.07 },
    evidence: {
      providerReasons: ["sanitary-symbol-overlap", "short-clutter-profile"],
      validatorReasons: ["duplicate-existing-advisory"],
    },
    localDraftFingerprint: createLocalDraftFingerprint(draft),
  };
}

function localStateSnapshot(draft: ValidatedRecognitionDraft): string {
  const {
    aiProposals: _aiProposals,
    proposalDecisions: _proposalDecisions,
    aiProposalMetadata: _aiProposalMetadata,
    diagnostics: _diagnostics,
    updatedAt: _updatedAt,
    ...localState
  } = draft;
  return JSON.stringify(localState);
}

function reconcile(
  draft: ValidatedRecognitionDraft,
  sanitized: readonly SanitizedRecognitionProposal[],
  proposalMetadata: RecognitionAiProposalMetadata,
  now = FIRST_RECONCILED_AT,
) {
  return reconcileAiProposalBatch({
    localDraft: draft,
    sanitized,
    metadata: proposalMetadata,
    now,
  });
}

describe("AI proposal reconciliation", () => {
  it("stores eligible, blocked and duplicate proposals separately in deterministic order without local mutation", () => {
    const draft = localDraft();
    const door = eligibleDoor(draft);
    const window = blockedWindow(draft);
    const review = duplicateWallReview(draft);

    const result = reconcile(draft, [door, review, window], metadata(draft));

    expect(localStateSnapshot(result)).toBe(localStateSnapshot(draft));
    expect(result.diagnostics).toEqual(draft.diagnostics);
    expect(result.aiProposals.map(({ id, state }) => [id, state])).toEqual([
      [door.id, "eligible"],
      [review.id, "duplicate"],
      [window.id, "blocked"],
    ]);
    expect(result.proposalDecisions).toEqual({ [door.id]: "pending" });
    expect(result.aiProposalMetadata).toEqual(metadata(draft));
    expect(result.updatedAt).toBe(FIRST_RECONCILED_AT);
  });

  it("creates decisions only for eligible proposals and keeps blocked or duplicate proposals impossible to accept", () => {
    const draft = localDraft();
    const door = eligibleDoor(draft);
    const window = blockedWindow(draft);
    const review = duplicateWallReview(draft);
    const result = reconcile(draft, [door, window, review], metadata(draft));

    expect(Object.keys(result.proposalDecisions)).toEqual([door.id]);
    expect(() => validateRecognitionDraft({
      ...result,
      proposalDecisions: {
        ...result.proposalDecisions,
        [window.id]: "accepted",
      },
    })).toThrow(/нельзя принять/i);
    expect(() => validateRecognitionDraft({
      ...result,
      proposalDecisions: {
        ...result.proposalDecisions,
        [review.id]: "accepted",
      },
    })).toThrow(/нельзя принять/i);
  });

  it("is idempotent for an identical batch and preserves an existing user decision", () => {
    const draft = localDraft();
    const door = eligibleDoor(draft);
    const first = reconcile(draft, [door], metadata(draft));
    const accepted = validateRecognitionDraft({
      ...first,
      proposalDecisions: { [door.id]: "accepted" },
    });

    const repeated = reconcile(
      accepted,
      [eligibleDoor(accepted)],
      metadata(accepted),
      SECOND_RECONCILED_AT,
    );

    expect(repeated).toEqual(accepted);
    expect(repeated.updatedAt).toBe(FIRST_RECONCILED_AT);
    expect(repeated.proposalDecisions).toEqual({ [door.id]: "accepted" });
  });

  it("replaces only proposal state for a new valid request and removes stale proposal decisions", () => {
    const draft = localDraft();
    const firstDoor = eligibleDoor(draft);
    const first = reconcile(draft, [firstDoor], metadata(draft));
    const accepted = validateRecognitionDraft({
      ...first,
      proposalDecisions: { [firstDoor.id]: "accepted" },
    });
    const secondRequestId = "request-2";
    const secondDoor = eligibleDoor(
      accepted,
      secondRequestId,
      "ai-proposal:request-2:door-new",
    );
    const secondMetadata = metadata(accepted, secondRequestId, SECOND_COMPLETED_AT);

    const result = reconcile(
      accepted,
      [secondDoor],
      secondMetadata,
      SECOND_RECONCILED_AT,
    );

    expect(localStateSnapshot(result)).toBe(localStateSnapshot(accepted));
    expect(result.aiProposals).toEqual([secondDoor]);
    expect(result.proposalDecisions).toEqual({ [secondDoor.id]: "pending" });
    expect(result.aiProposalMetadata).toEqual(secondMetadata);
    expect(result.updatedAt).toBe(SECOND_RECONCILED_AT);
  });

  it("rejects a proposal/local candidate ID collision without changing the previous valid proposal batch", () => {
    const draft = localDraft();
    const firstDoor = eligibleDoor(draft);
    const current = reconcile(draft, [firstDoor], metadata(draft));
    const colliding = eligibleDoor(
      current,
      "request-2",
      "wall-1",
    );

    const result = reconcile(
      current,
      [colliding],
      metadata(current, "request-2", SECOND_COMPLETED_AT),
      SECOND_RECONCILED_AT,
    );

    expect(result.aiProposals).toEqual(current.aiProposals);
    expect(result.proposalDecisions).toEqual(current.proposalDecisions);
    expect(result.aiProposalMetadata).toEqual(current.aiProposalMetadata);
    expect(localStateSnapshot(result)).toBe(localStateSnapshot(current));
    expect(result.diagnostics.at(-1)).toMatchObject({
      code: "ai-proposal-reconciliation-rejected",
      severity: "warning",
      candidateId: null,
    });
  });

  it("preserves the current valid batch for a stale incoming identity and bounds repeated diagnostics", () => {
    const draft = localDraft();
    const door = eligibleDoor(draft);
    const current = reconcile(draft, [door], metadata(draft));
    const staleMetadata = {
      ...metadata(current, "request-stale", SECOND_COMPLETED_AT),
      localDraftFingerprint: `recognition-local-draft-v1:${"f".repeat(64)}`,
    };
    const staleDoor = {
      ...eligibleDoor(current, "request-stale", "ai-proposal:request-stale:door"),
      localDraftFingerprint: staleMetadata.localDraftFingerprint,
    };

    const firstFailure = reconcile(
      current,
      [staleDoor],
      staleMetadata,
      SECOND_RECONCILED_AT,
    );
    const repeatedFailure = reconcile(
      firstFailure,
      [staleDoor],
      staleMetadata,
      "2026-08-05T02:02:00.000Z",
    );

    expect(repeatedFailure.aiProposals).toEqual(current.aiProposals);
    expect(repeatedFailure.proposalDecisions).toEqual(current.proposalDecisions);
    expect(repeatedFailure.aiProposalMetadata).toEqual(current.aiProposalMetadata);
    expect(repeatedFailure.diagnostics.filter(({ code }) =>
      code === "ai-proposal-reconciliation-rejected")).toHaveLength(1);
  });

  it("invalidates old proposals and decisions when local geometry changes fingerprint", () => {
    const draft = localDraft();
    const door = eligibleDoor(draft);
    const current = reconcile(draft, [door], metadata(draft));
    const changed = validateRecognitionDraft({
      ...current,
      walls: current.walls.map((wall) => wall.id === "wall-1"
        ? { ...wall, end: { x: 0.86, y: 0.2 } }
        : wall),
      updatedAt: "2026-08-05T01:30:00.000Z",
    });

    const result = reconcile(
      changed,
      current.aiProposals,
      current.aiProposalMetadata!,
      SECOND_RECONCILED_AT,
    );

    expect(result.aiProposals).toEqual([]);
    expect(result.proposalDecisions).toEqual({});
    expect(result.aiProposalMetadata).toBeNull();
    expect(result.walls).toEqual(changed.walls);
    expect(result.decisions).toEqual(changed.decisions);
    expect(result.diagnostics.some(({ code }) =>
      code === "ai-proposal-state-invalidated")).toBe(true);
  });

  it("preserves the previous valid batch and local candidates when provider output is internally inconsistent", () => {
    const draft = localDraft();
    const door = eligibleDoor(draft);
    const current = reconcile(draft, [door], metadata(draft));
    const malformed = {
      ...eligibleDoor(current, "request-2", "ai-proposal:request-2:door"),
      provider: provider("different-request"),
    };

    const result = reconcile(
      current,
      [malformed],
      metadata(current, "request-2", SECOND_COMPLETED_AT),
      SECOND_RECONCILED_AT,
    );

    expect(result.aiProposals).toEqual(current.aiProposals);
    expect(result.proposalDecisions).toEqual(current.proposalDecisions);
    expect(result.aiProposalMetadata).toEqual(current.aiProposalMetadata);
    expect(result.walls).toEqual(current.walls);
    expect(result.openings).toEqual(current.openings);
    expect(result.decisions).toEqual(current.decisions);
    expect(result.diagnostics.at(-1)?.code).toBe("ai-proposal-reconciliation-rejected");
  });
});
