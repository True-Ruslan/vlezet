import { createEmptyDocument } from "@vlezet/domain";
import type { ReferencePlan } from "@vlezet/projects";
import {
  AI_PROPOSAL_SCHEMA_VERSION,
  createLocalDraftFingerprint,
  validateRecognitionDraft,
  type SanitizedRecognitionProposal,
} from "@vlezet/recognition";
import { describe, expect, it } from "vitest";
import { planRecognitionApply } from "./recognition-apply";

const NOW = "2026-08-06T08:00:00.000Z";
const LOCAL_ID = "local-candidate";
const ADVISORY_ID = "ai-proposal:request-1:advisory-1";

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

function ids() {
  let index = 0;
  return (kind: "wall" | "vertex" | "opening") => `unused-${kind}-${++index}`;
}

describe("accepted AI advisory apply", () => {
  it("creates no document geometry after only the related local candidate is declined", () => {
    const local = validateRecognitionDraft({
      id: "draft-1",
      projectId: "project-1",
      referenceAssetId: referencePlan.assetId,
      referenceRevision: referencePlan.referenceRevision,
      engineVersion: "1",
      status: "local-complete",
      walls: [{
        id: LOCAL_ID,
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.9, y: 0.2 },
        estimatedThicknessPx: 20,
        confidence: "low",
        evidence: { localScore: 0.4, cloudScore: null, reasons: ["structural-clutter-veto-passed"] },
        origin: "local",
        conflict: null,
      }],
      openings: [],
      roomLabels: [],
      diagnostics: [],
      decisions: { [LOCAL_ID]: "rejected" },
      source: { local: true, cloud: false },
      createdAt: NOW,
      updatedAt: NOW,
    });
    const fingerprint = createLocalDraftFingerprint(local);
    const advisory: SanitizedRecognitionProposal = {
      id: ADVISORY_ID,
      rawProposalId: "advisory-1",
      kind: "local-wall-review",
      state: "eligible",
      geometry: null,
      targetLocalCandidateId: LOCAL_ID,
      hostWallCandidateId: null,
      provider: {
        providerId: "openrouter-direct",
        modelId: "vision/model",
        requestId: "request-1",
      },
      modelConfidence: 0.78,
      deterministicConfidence: "low",
      sourceRegion: { x: 0.08, y: 0.18, width: 0.84, height: 0.05 },
      evidence: {
        providerReasons: ["sanitary-symbol-overlap", "weak-structural-mask-support"],
        validatorReasons: ["exact-local-wall-target-validated", "structural-clutter-veto-passed"],
      },
      localDraftFingerprint: fingerprint,
    };
    const draft = validateRecognitionDraft({
      ...local,
      aiProposals: [advisory],
      proposalDecisions: { [ADVISORY_ID]: "accepted" },
      aiProposalMetadata: {
        schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
        requestId: advisory.provider.requestId,
        referenceRevision: local.referenceRevision,
        localDraftFingerprint: fingerprint,
        providerId: advisory.provider.providerId,
        modelId: advisory.provider.modelId,
        completedAt: NOW,
      },
    });
    const before = createEmptyDocument();

    const plan = planRecognitionApply({
      draft,
      referencePlan,
      document: before,
      idFactory: ids(),
    });

    expect(plan.document).toBe(before);
    expect(plan.document.walls).toEqual([]);
    expect(plan.document.openings).toEqual([]);
    expect(plan.appliedCandidateIds).toEqual([]);
    expect(plan.diagnostics.some(({ severity }) => severity === "error")).toBe(false);
  });
});
