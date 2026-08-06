import {
  AI_PROPOSAL_SCHEMA_VERSION,
  createLocalDraftFingerprint,
  MemoryRecognitionSessionRepository,
  type RecognitionDraft,
  type RecognitionSessionRecord,
  type SanitizedRecognitionProposal,
} from "@vlezet/recognition";
import { describe, expect, it } from "vitest";
import { RecognitionController, type RecognitionControllerState } from "./recognition-controller";

const now = "2026-08-06T07:00:00.000Z";

function createSession(): RecognitionSessionRecord {
  const localDraft: RecognitionDraft = {
    id: "draft-review-actions",
    projectId: "project-review-actions",
    referenceAssetId: "asset-review-actions",
    referenceRevision: "revision-review-actions",
    engineVersion: "5",
    status: "local-complete",
    walls: [{
      id: "local-wall",
      start: { x: 0.1, y: 0.4 },
      end: { x: 0.9, y: 0.4 },
      estimatedThicknessPx: 18,
      confidence: "medium",
      evidence: {
        localScore: 0.76,
        cloudScore: null,
        reasons: ["filled-wall-region-evidence"],
      },
      origin: "local",
      conflict: null,
    }],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "local-wall": "pending" },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: now,
    updatedAt: now,
  };
  const fingerprint = createLocalDraftFingerprint(localDraft);
  const provider = {
    providerId: "openrouter",
    modelId: "vision/model-reviewed",
    requestId: "request-review-actions",
  } as const;
  const proposals: readonly SanitizedRecognitionProposal[] = [{
    id: "eligible-door",
    rawProposalId: "raw-door",
    kind: "door",
    state: "eligible",
    geometry: {
      kind: "opening",
      center: { x: 0.4, y: 0.4 },
      widthNormalized: 0.08,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: "local-wall",
    sourceRegion: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
    modelConfidence: 0.87,
    deterministicConfidence: "medium",
    evidence: {
      providerReasons: ["visible-gap", "door-arc"],
      validatorReasons: ["local-rejected-door-evidence-matched", "structural-gap-validated"],
    },
    provider,
    localDraftFingerprint: fingerprint,
  }, {
    id: "eligible-wall-review",
    rawProposalId: "raw-wall-review",
    kind: "local-wall-review",
    state: "eligible",
    geometry: null,
    targetLocalCandidateId: "local-wall",
    hostWallCandidateId: null,
    sourceRegion: { x: 0.2, y: 0.3, width: 0.3, height: 0.2 },
    modelConfidence: 0.78,
    deterministicConfidence: "low",
    evidence: {
      providerReasons: ["sanitary-symbol-overlap", "weak-structural-mask-support"],
      validatorReasons: ["exact-local-wall-target-validated", "structural-clutter-veto-passed"],
    },
    provider,
    localDraftFingerprint: fingerprint,
  }];
  const draft: RecognitionDraft = {
    ...localDraft,
    aiProposals: proposals,
    proposalDecisions: {
      "eligible-door": "pending",
      "eligible-wall-review": "pending",
    },
    aiProposalMetadata: {
      schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
      requestId: provider.requestId,
      referenceRevision: localDraft.referenceRevision,
      localDraftFingerprint: fingerprint,
      providerId: provider.providerId,
      modelId: provider.modelId,
      completedAt: now,
    },
  };
  return {
    id: "session-review-actions",
    projectId: draft.projectId,
    referenceAssetId: draft.referenceAssetId,
    referenceRevision: draft.referenceRevision,
    engineVersion: draft.engineVersion,
    draft,
    cloudMetadata: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("controller-owned proposal review actions", () => {
  it("publishes runtime actions that persist eligible decisions and exact wall advisory agreement", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    const initial = createSession();
    await repository.put(initial);
    let observed: RecognitionControllerState = { kind: "idle", session: null };
    const controller = new RecognitionController({
      repository,
      runLocal: async () => { throw new Error("not used"); },
      onState: (state) => { observed = state; },
    });

    await controller.restore(initial.projectId, {
      assetId: initial.referenceAssetId,
      referenceRevision: initial.referenceRevision,
    });

    expect(observed.kind).toBe("review");
    if (observed.kind !== "review") throw new Error("Expected review state");
    expect(observed.proposalActions).toBeDefined();

    await observed.proposalActions?.updateDecision("eligible-door", "accepted");
    const afterDoor = await repository.getForProject(initial.projectId);
    expect(afterDoor?.draft.proposalDecisions["eligible-door"]).toBe("accepted");

    expect(controller.state.kind).toBe("review");
    if (controller.state.kind !== "review") throw new Error("Expected updated review state");
    await controller.state.proposalActions?.agreeWithWallAdvisory("eligible-wall-review");

    const persisted = await repository.getForProject(initial.projectId);
    expect(persisted?.draft.proposalDecisions["eligible-wall-review"]).toBe("accepted");
    expect(persisted?.draft.decisions["local-wall"]).toBe("rejected");
    expect(persisted?.draft.walls).toEqual(initial.draft.walls);
  });
});
