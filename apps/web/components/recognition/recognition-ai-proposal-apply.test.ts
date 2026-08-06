import { createEmptyDocument } from "@vlezet/domain";
import type { ReferencePlan } from "@vlezet/projects";
import {
  AI_PROPOSAL_SCHEMA_VERSION,
  createLocalDraftFingerprint,
  validateRecognitionDraft,
  type RecognitionDraft,
  type RecognitionOpeningCandidate,
  type SanitizedRecognitionProposal,
} from "@vlezet/recognition";
import { describe, expect, it } from "vitest";
import { planRecognitionApply } from "./recognition-apply";

const NOW = "2026-08-06T08:00:00.000Z";
const WALL_ID = "wall-local";
const PROPOSAL_ID = "ai-proposal:request-1:opening-1";

const referencePlan: ReferencePlan = {
  assetId: "asset-1",
  referenceRevision: "revision-1",
  source: { kind: "image", originalMimeType: "image/png" },
  widthPx: 1000,
  heightPx: 500,
  transform: { originWorld: { x: 0, y: 0 }, millimetersPerPixel: 2, rotationDeg: 0 },
  calibration: {
    pointA: { x: 0, y: 0 },
    pointB: { x: 500, y: 0 },
    knownLengthMm: 1000,
    alignment: "horizontal",
  },
  display: { visible: true, opacity: 0.45, locked: true },
};

function ids(prefix: string) {
  let index = 0;
  return (kind: "wall" | "vertex" | "opening") => `${prefix}-${kind}-${++index}`;
}

function localDraft(openings: readonly RecognitionOpeningCandidate[] = []) {
  return validateRecognitionDraft({
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: referencePlan.assetId,
    referenceRevision: referencePlan.referenceRevision,
    engineVersion: "1",
    status: "local-complete",
    walls: [{
      id: WALL_ID,
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.9, y: 0.2 },
      estimatedThicknessPx: 20,
      confidence: "high",
      evidence: { localScore: 0.95, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
      origin: "local",
      conflict: null,
    }],
    openings,
    roomLabels: [],
    diagnostics: [],
    decisions: Object.fromEntries([
      [WALL_ID, "accepted"],
      ...openings.map((opening) => [opening.id, "accepted"] as const),
    ]),
    source: { local: true, cloud: false },
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function proposal(
  local: ReturnType<typeof localDraft>,
  kind: "door" | "window" = "door",
): SanitizedRecognitionProposal {
  return {
    id: PROPOSAL_ID,
    rawProposalId: "opening-1",
    kind,
    state: "eligible",
    geometry: {
      kind: "opening",
      center: { x: 0.5, y: 0.2 },
      widthNormalized: 0.05,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: WALL_ID,
    provider: {
      providerId: "openrouter-direct",
      modelId: "vision/model",
      requestId: "request-1",
    },
    modelConfidence: 0.88,
    deterministicConfidence: "medium",
    sourceRegion: { x: 0.45, y: 0.15, width: 0.1, height: 0.1 },
    evidence: {
      providerReasons: ["visible-gap", kind === "door" ? "door-arc" : "parallel-window-rails"],
      validatorReasons: ["local-rejected-opening-evidence-matched", "structural-gap-validated"],
    },
    localDraftFingerprint: createLocalDraftFingerprint(local),
  };
}

function proposalDraft(kind: "door" | "window" = "door"): RecognitionDraft {
  const local = localDraft();
  const acceptedProposal = proposal(local, kind);
  return validateRecognitionDraft({
    ...local,
    aiProposals: [acceptedProposal],
    proposalDecisions: { [acceptedProposal.id]: "accepted" },
    aiProposalMetadata: {
      schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
      requestId: acceptedProposal.provider.requestId,
      referenceRevision: local.referenceRevision,
      localDraftFingerprint: acceptedProposal.localDraftFingerprint,
      providerId: acceptedProposal.provider.providerId,
      modelId: acceptedProposal.provider.modelId,
      completedAt: NOW,
    },
  });
}

function ordinaryOpening(kind: "door" | "window"): RecognitionOpeningCandidate {
  return {
    id: `local-${kind}`,
    kind,
    hostWallCandidateId: WALL_ID,
    center: { x: 0.5, y: 0.2 },
    widthPx: 50,
    orientationDeg: 0,
    confidence: "high",
    evidence: { localScore: 0.9, cloudScore: null, reasons: ["wall-gap", "opening-symbol"] },
    origin: "local",
    conflict: null,
  };
}

describe("atomic AI proposal document apply", () => {
  it("applies a new local host wall and its accepted proposal in one immutable batch", () => {
    const before = createEmptyDocument();
    const plan = planRecognitionApply({
      draft: proposalDraft("door"),
      referencePlan,
      document: before,
      idFactory: ids("first"),
    });

    expect(plan.document).not.toBe(before);
    expect(plan.document.walls).toHaveLength(1);
    expect(plan.document.openings).toHaveLength(1);
    expect(plan.appliedCandidateIds).toEqual([WALL_ID, PROPOSAL_ID]);
    expect(plan.diagnostics.some(({ severity }) => severity === "error")).toBe(false);
  });

  it("treats a repeated proposal Apply as an informational no-op without duplicates", () => {
    const draft = proposalDraft("door");
    const first = planRecognitionApply({
      draft,
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids("first"),
    });
    const second = planRecognitionApply({
      draft,
      referencePlan,
      document: first.document,
      idFactory: ids("second"),
    });

    expect(second.document).toBe(first.document);
    expect(second.document.walls).toHaveLength(1);
    expect(second.document.openings).toHaveLength(1);
    expect(second.appliedCandidateIds).toEqual([]);
    expect(second.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "info", message: expect.stringMatching(/не добавлен[а]? повторно/i) }),
    ]));
  });

  it("rolls back the whole mixed batch when one accepted local item is invalid", () => {
    const invalidOpening: RecognitionOpeningCandidate = {
      ...ordinaryOpening("door"),
      id: "unclassified-opening",
      kind: "unknown-opening",
    };
    const local = localDraft([invalidOpening]);
    const acceptedProposal = proposal(local, "door");
    const draft = validateRecognitionDraft({
      ...local,
      aiProposals: [acceptedProposal],
      proposalDecisions: { [acceptedProposal.id]: "accepted" },
      aiProposalMetadata: {
        schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
        requestId: acceptedProposal.provider.requestId,
        referenceRevision: local.referenceRevision,
        localDraftFingerprint: acceptedProposal.localDraftFingerprint,
        providerId: acceptedProposal.provider.providerId,
        modelId: acceptedProposal.provider.modelId,
        completedAt: NOW,
      },
    });
    const before = createEmptyDocument();
    const serializedBefore = JSON.stringify(before);

    const plan = planRecognitionApply({
      draft,
      referencePlan,
      document: before,
      idFactory: ids("rollback"),
    });

    expect(plan.document).toBe(before);
    expect(JSON.stringify(plan.document)).toBe(serializedBefore);
    expect(plan.appliedCandidateIds).toEqual([]);
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: invalidOpening.id,
      severity: "error",
      message: expect.stringMatching(/классифицировать/i),
    }));
  });

  it("detects a conflicting document change between review and Apply and preserves it byte-for-byte", () => {
    const existing = planRecognitionApply({
      draft: localDraft([ordinaryOpening("door")]),
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids("existing"),
    }).document;
    const serializedExisting = JSON.stringify(existing);

    const plan = planRecognitionApply({
      draft: proposalDraft("window"),
      referencePlan,
      document: existing,
      idFactory: ids("conflict"),
    });

    expect(plan.document).toBe(existing);
    expect(JSON.stringify(plan.document)).toBe(serializedExisting);
    expect(plan.appliedCandidateIds).toEqual([]);
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: PROPOSAL_ID,
      severity: "error",
      message: expect.stringMatching(/перекрывает существующий проём/i),
    }));
  });
});
