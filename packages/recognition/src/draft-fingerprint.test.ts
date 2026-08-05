import { describe, expect, it } from "vitest";
import {
  createRecognitionDraftFingerprint,
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
      evidence: { localScore: 0.94, cloudScore: null, reasons: ["parallel-edges", "filled-wall-region-evidence"] },
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
      evidence: { localScore: 0.72, cloudScore: null, reasons: ["wall-gap", "host-wall-validated"] },
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

describe("local Draft fingerprint", () => {
  it("returns a lowercase SHA-256 digest", () => {
    expect(createRecognitionDraftFingerprint(draft())).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is stable across timestamps, status, diagnostics and proposal state", () => {
    const source = draft();
    const changed: RecognitionDraft = {
      ...source,
      status: "reconciled",
      diagnostics: [{ code: "changed", severity: "warning", message: "changed", candidateId: "wall-1" }],
      aiProposals: [],
      proposalDecisions: {},
      aiProposalMetadata: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    };
    expect(createRecognitionDraftFingerprint(changed)).toBe(createRecognitionDraftFingerprint(source));
  });

  it("is invariant to wall, opening, decision and evidence-reason ordering", () => {
    const secondWall = {
      ...draft().walls[0]!,
      id: "wall-2",
      start: { x: 0.2, y: 0.8 },
      end: { x: 0.8, y: 0.8 },
      evidence: { localScore: 0.8, cloudScore: null, reasons: ["b", "a"] },
    };
    const secondOpening = {
      ...draft().openings[0]!,
      id: "opening-2",
      hostWallCandidateId: "wall-2",
      center: { x: 0.6, y: 0.8 },
    };
    const first = draft({
      walls: [draft().walls[0]!, secondWall],
      openings: [draft().openings[0]!, secondOpening],
      decisions: { "wall-1": "pending", "opening-1": "accepted", "wall-2": "rejected", "opening-2": "edited" },
    });
    const second = draft({
      walls: [{ ...secondWall, evidence: { ...secondWall.evidence, reasons: ["a", "b"] } }, draft().walls[0]!],
      openings: [secondOpening, draft().openings[0]!],
      decisions: { "opening-2": "edited", "wall-2": "rejected", "opening-1": "accepted", "wall-1": "pending" },
    });
    expect(createRecognitionDraftFingerprint(second)).toBe(createRecognitionDraftFingerprint(first));
  });

  it("changes for geometry, classification, host, confidence, evidence, decision or reference identity changes", () => {
    const source = draft();
    const mutations: RecognitionDraft[] = [
      { ...source, referenceAssetId: "asset-2" },
      { ...source, referenceRevision: "revision-2" },
      { ...source, engineVersion: "6" },
      { ...source, walls: [{ ...source.walls[0]!, end: { x: 0.85, y: 0.2 } }] },
      { ...source, walls: [{ ...source.walls[0]!, estimatedThicknessPx: 22 }] },
      { ...source, walls: [{ ...source.walls[0]!, confidence: "medium" }] },
      { ...source, walls: [{ ...source.walls[0]!, evidence: { ...source.walls[0]!.evidence, localScore: 0.8 } }] },
      { ...source, openings: [{ ...source.openings[0]!, kind: "window" }] },
      { ...source, openings: [{ ...source.openings[0]!, hostWallCandidateId: null }] },
      { ...source, openings: [{ ...source.openings[0]!, widthPx: 100 }] },
      { ...source, decisions: { ...source.decisions, "opening-1": "accepted" } },
    ];
    const fingerprint = createRecognitionDraftFingerprint(source);
    for (const mutation of mutations) {
      expect(createRecognitionDraftFingerprint(mutation)).not.toBe(fingerprint);
    }
  });

  it("normalizes negative zero and finite decimal representation", () => {
    const source = draft();
    const negativeZero = draft({
      walls: [{ ...source.walls[0]!, start: { x: -0, y: 0.2 } }],
    });
    const positiveZero = draft({
      walls: [{ ...source.walls[0]!, start: { x: 0, y: 0.2 } }],
    });
    expect(createRecognitionDraftFingerprint(negativeZero)).toBe(createRecognitionDraftFingerprint(positiveZero));
  });
});
