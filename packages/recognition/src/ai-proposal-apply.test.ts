import { describe, expect, it } from "vitest";
import {
  AI_PROPOSAL_SCHEMA_VERSION,
  createLocalDraftFingerprint,
  prepareAtomicRecognitionApply,
  validateRecognitionDraft,
  type RecognitionDraft,
  type SanitizedRecognitionProposal,
} from "./index";

const NOW = "2026-08-06T08:00:00.000Z";
const PROPOSAL_ID = "ai-proposal:request-1:door-1";

function localDraft(): ReturnType<typeof validateRecognitionDraft> {
  const draft: RecognitionDraft = {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "1",
    status: "local-complete",
    walls: [{
      id: "wall-1",
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.9, y: 0.2 },
      estimatedThicknessPx: 20,
      confidence: "high",
      evidence: { localScore: 0.95, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
      origin: "local",
      conflict: null,
    }],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "accepted" },
    source: { local: true, cloud: false },
    createdAt: NOW,
    updatedAt: NOW,
  };
  return validateRecognitionDraft(draft);
}

function eligibleDoor(
  draft: ReturnType<typeof validateRecognitionDraft>,
): SanitizedRecognitionProposal {
  return {
    id: PROPOSAL_ID,
    rawProposalId: "door-1",
    kind: "door",
    state: "eligible",
    geometry: {
      kind: "opening",
      center: { x: 0.5, y: 0.2 },
      widthNormalized: 0.08,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: "wall-1",
    provider: {
      providerId: "openrouter-direct",
      modelId: "vision/model",
      requestId: "request-1",
    },
    modelConfidence: 0.88,
    deterministicConfidence: "medium",
    sourceRegion: { x: 0.45, y: 0.15, width: 0.1, height: 0.1 },
    evidence: {
      providerReasons: ["visible-gap", "door-arc"],
      validatorReasons: ["local-rejected-door-evidence-matched", "structural-gap-validated"],
    },
    localDraftFingerprint: createLocalDraftFingerprint(draft),
  };
}

function withProposals(input: Readonly<{
  proposal?: SanitizedRecognitionProposal;
  proposalDecision?: "pending" | "accepted" | "rejected";
  wallDecision?: "pending" | "accepted" | "rejected" | "edited";
}> = {}) {
  const local = localDraft();
  const fingerprint = createLocalDraftFingerprint(local);
  const proposal = input.proposal ?? eligibleDoor(local);
  return validateRecognitionDraft({
    ...local,
    decisions: {
      ...local.decisions,
      "wall-1": input.wallDecision ?? "accepted",
    },
    aiProposals: [proposal],
    proposalDecisions: {
      [proposal.id]: input.proposalDecision ?? "accepted",
    },
    aiProposalMetadata: {
      schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
      requestId: "request-1",
      referenceRevision: local.referenceRevision,
      localDraftFingerprint: fingerprint,
      providerId: "openrouter-direct",
      modelId: "vision/model",
      completedAt: NOW,
    },
  });
}

const referencePlan = {
  assetId: "asset-1",
  referenceRevision: "revision-1",
  widthPx: 1000,
  heightPx: 500,
};

const document = {
  walls: [],
  openings: [],
};

describe("atomic AI proposal apply preflight", () => {
  it("materializes an accepted eligible opening into a transient ordinary Draft", () => {
    const result = prepareAtomicRecognitionApply({
      draft: withProposals(),
      referencePlan,
      document,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.acceptedProposalIds).toEqual([PROPOSAL_ID]);
    expect(result.applicableDraft.openings).toContainEqual(expect.objectContaining({
      id: PROPOSAL_ID,
      kind: "door",
      hostWallCandidateId: "wall-1",
      center: { x: 0.5, y: 0.2 },
      widthPx: 80,
      orientationDeg: 0,
      confidence: "medium",
      origin: "merged",
      conflict: null,
    }));
    expect(result.applicableDraft.decisions[PROPOSAL_ID]).toBe("accepted");
  });

  it("emits no geometry for an accepted local-wall advisory", () => {
    const local = localDraft();
    const fingerprint = createLocalDraftFingerprint(local);
    const advisory: SanitizedRecognitionProposal = {
      ...eligibleDoor(local),
      id: "ai-proposal:request-1:wall-review-1",
      rawProposalId: "wall-review-1",
      kind: "local-wall-review",
      geometry: null,
      targetLocalCandidateId: "wall-1",
      hostWallCandidateId: null,
      deterministicConfidence: "low",
      localDraftFingerprint: fingerprint,
    };
    const result = prepareAtomicRecognitionApply({
      draft: withProposals({ proposal: advisory }),
      referencePlan,
      document,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.acceptedProposalIds).toEqual([]);
    expect(result.applicableDraft.openings).toEqual([]);
  });

  it("fails closed when the proposal fingerprint is stale", () => {
    const draft = withProposals();
    const staleProposal = {
      ...draft.aiProposals[0]!,
      localDraftFingerprint: `recognition-local-draft-v1:${"a".repeat(64)}`,
    };
    const result = prepareAtomicRecognitionApply({
      draft: validateRecognitionDraft({ ...draft, aiProposals: [staleProposal] }),
      referencePlan,
      document,
    });

    expect(result.acceptedProposalIds).toEqual([]);
    expect(result.applicableDraft.openings).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: PROPOSAL_ID,
      severity: "error",
      message: expect.stringMatching(/устарел|fingerprint/i),
    }));
  });

  it("fails closed when an accepted proposal is blocked or duplicate", () => {
    const local = localDraft();
    const blocked = { ...eligibleDoor(local), state: "blocked" as const };
    const result = prepareAtomicRecognitionApply({
      draft: withProposals({ proposal: blocked }),
      referencePlan,
      document,
    });

    expect(result.acceptedProposalIds).toEqual([]);
    expect(result.applicableDraft.openings).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: PROPOSAL_ID,
      severity: "error",
      message: expect.stringMatching(/не допущено|blocked|eligible/i),
    }));
  });

  it("fails the dependent proposal when its local host is not accepted", () => {
    const result = prepareAtomicRecognitionApply({
      draft: withProposals({ wallDecision: "rejected" }),
      referencePlan,
      document,
    });

    expect(result.acceptedProposalIds).toEqual([]);
    expect(result.applicableDraft.openings).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: PROPOSAL_ID,
      severity: "error",
      message: expect.stringMatching(/стена-хозяин|host/i),
    }));
  });
});
