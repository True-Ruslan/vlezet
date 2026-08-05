import { describe, expect, it } from "vitest";
import {
  assertAiProposalBatchIdentity,
  createAiProposalRequestIdentity,
  createLocalDraftFingerprint,
  type AiProposalBatch,
  type RecognitionDraft,
  type ValidatedRecognitionDraft,
} from "./index";

const NOW = "2026-08-05T00:00:00.000Z";

function draft(overrides: Partial<ValidatedRecognitionDraft> = {}): ValidatedRecognitionDraft {
  return {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [{
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
    }],
    openings: [{
      id: "opening-1",
      kind: "door",
      hostWallCandidateId: "wall-1",
      center: { x: 0.4, y: 0.2 },
      widthPx: 90,
      orientationDeg: 0,
      confidence: "medium",
      evidence: {
        localScore: 0.72,
        cloudScore: null,
        reasons: ["wall-gap", "host-wall-validated"],
      },
      origin: "local",
      conflict: null,
    }],
    roomLabels: [],
    diagnostics: [{ code: "info", severity: "info", message: "diagnostic", candidateId: null }],
    decisions: { "wall-1": "pending", "opening-1": "pending" },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function batch(input: Readonly<{
  requestId?: string;
  referenceRevision?: string;
  localDraftFingerprint?: string;
}> = {}): AiProposalBatch {
  return {
    schemaVersion: "recognition-ai-proposals-v1",
    requestId: input.requestId ?? "request-1",
    referenceRevision: input.referenceRevision ?? "revision-1",
    localDraftFingerprint: input.localDraftFingerprint ?? createLocalDraftFingerprint(draft()),
    proposals: [],
    diagnostics: [],
  };
}

describe("local Draft fingerprint and proposal request identity", () => {
  it("returns a versioned lowercase SHA-256 digest", () => {
    expect(createLocalDraftFingerprint(draft()))
      .toMatch(/^recognition-local-draft-v1:[a-f0-9]{64}$/);
  });

  it("is stable across timestamps, status, diagnostics, decisions and proposal state", () => {
    const source = draft();
    const changed: RecognitionDraft = {
      ...source,
      status: "reconciled",
      diagnostics: [{ code: "changed", severity: "warning", message: "changed", candidateId: "wall-1" }],
      decisions: { "wall-1": "accepted", "opening-1": "rejected" },
      aiProposals: [],
      proposalDecisions: {},
      aiProposalMetadata: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    };
    expect(createLocalDraftFingerprint(changed)).toBe(createLocalDraftFingerprint(source));
  });

  it("is invariant to wall, opening and evidence-reason ordering after canonical ID sort", () => {
    const base = draft();
    const secondWall = {
      ...base.walls[0]!,
      id: "wall-2",
      start: { x: 0.2, y: 0.8 },
      end: { x: 0.8, y: 0.8 },
      evidence: { localScore: 0.8, cloudScore: null, reasons: ["b", "a"] },
    };
    const secondOpening = {
      ...base.openings[0]!,
      id: "opening-2",
      hostWallCandidateId: "wall-2",
      center: { x: 0.6, y: 0.8 },
    };
    const first = draft({
      walls: [base.walls[0]!, secondWall],
      openings: [base.openings[0]!, secondOpening],
    });
    const second = draft({
      walls: [{ ...secondWall, evidence: { ...secondWall.evidence, reasons: ["a", "b"] } }, base.walls[0]!],
      openings: [secondOpening, base.openings[0]!],
    });
    expect(createLocalDraftFingerprint(second)).toBe(createLocalDraftFingerprint(first));
  });

  it("changes for local wall and opening structural changes", () => {
    const source = draft();
    const mutations: RecognitionDraft[] = [
      { ...source, walls: [{ ...source.walls[0]!, end: { x: 0.85, y: 0.2 } }] },
      { ...source, walls: [{ ...source.walls[0]!, estimatedThicknessPx: 22 }] },
      { ...source, walls: [{ ...source.walls[0]!, confidence: "medium" }] },
      { ...source, walls: [{ ...source.walls[0]!, conflict: "unsupported" }] },
      { ...source, walls: [{ ...source.walls[0]!, evidence: { ...source.walls[0]!.evidence, localScore: 0.8 } }] },
      { ...source, openings: [{ ...source.openings[0]!, kind: "window" }] },
      { ...source, openings: [{ ...source.openings[0]!, hostWallCandidateId: null }] },
      { ...source, openings: [{ ...source.openings[0]!, widthPx: 100 }] },
      { ...source, openings: [{ ...source.openings[0]!, orientationDeg: 90 }] },
    ];
    const fingerprint = createLocalDraftFingerprint(source);
    for (const mutation of mutations) {
      expect(createLocalDraftFingerprint(mutation)).not.toBe(fingerprint);
    }
  });

  it("normalizes negative zero", () => {
    const source = draft();
    const negativeZero = draft({
      walls: [{ ...source.walls[0]!, start: { x: -0, y: 0.2 } }],
    });
    const positiveZero = draft({
      walls: [{ ...source.walls[0]!, start: { x: 0, y: 0.2 } }],
    });
    expect(createLocalDraftFingerprint(negativeZero)).toBe(createLocalDraftFingerprint(positiveZero));
  });

  it("creates exact request identity and rejects request, revision or fingerprint mismatch", () => {
    const localDraft = draft();
    const identity = createAiProposalRequestIdentity({
      requestId: "request-1",
      referenceRevision: "revision-1",
      localDraft,
    });
    expect(identity).toEqual({
      requestId: "request-1",
      referenceRevision: "revision-1",
      localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    });
    expect(() => assertAiProposalBatchIdentity(batch(), identity)).not.toThrow();
    expect(() => assertAiProposalBatchIdentity(batch({ requestId: "request-2" }), identity)).toThrow();
    expect(() => assertAiProposalBatchIdentity(batch({ referenceRevision: "revision-2" }), identity)).toThrow();
    expect(() => assertAiProposalBatchIdentity(batch({
      localDraftFingerprint: "recognition-local-draft-v1:" + "b".repeat(64),
    }), identity)).toThrow();
  });
});
