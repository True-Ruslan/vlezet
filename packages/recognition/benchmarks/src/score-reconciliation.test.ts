import type { RecognitionDraft } from "../../src/model";
import { describe, expect, it } from "vitest";
import { scoreReconciliation } from "./score-reconciliation";

function wall(id: string) {
  return {
    id,
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.9, y: 0.1 },
    estimatedThicknessPx: 15,
    confidence: "medium" as const,
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["test"] },
    origin: "local" as const,
    conflict: null,
  };
}

function validDraft(): RecognitionDraft {
  return {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "3",
    status: "reconciled",
    walls: [wall("wall-1")],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending" },
    source: { local: true, cloud: true },
    createdAt: "2026-08-01T20:00:00.000Z",
    updatedAt: "2026-08-01T20:00:00.000Z",
  };
}

describe("recognition reconciliation integrity scoring", () => {
  it("reports zero invariant violations for a valid draft", () => {
    expect(scoreReconciliation(validDraft())).toEqual({
      staleDecisionCount: 0,
      missingPendingDecisionCount: 0,
      duplicateCandidateIdCount: 0,
      unknownDiagnosticReferenceCount: 0,
      malformedDecisionCount: 0,
    });
  });

  it("counts stale decisions without validating the raw snapshot first", () => {
    const raw = { ...validDraft(), decisions: { "wall-1": "pending", removed: "accepted" } };
    expect(scoreReconciliation(raw).staleDecisionCount).toBe(1);
  });

  it("counts candidates without a pending decision", () => {
    const raw = { ...validDraft(), walls: [wall("wall-1"), wall("wall-2")] };
    expect(scoreReconciliation(raw).missingPendingDecisionCount).toBe(1);
  });

  it("counts duplicate candidate IDs across candidate kinds", () => {
    const raw = {
      ...validDraft(),
      roomLabels: [{ id: "wall-1", text: "Комната", anchor: { x: 0.5, y: 0.5 }, confidence: "low", origin: "cloud" }],
    };
    expect(scoreReconciliation(raw).duplicateCandidateIdCount).toBe(1);
  });

  it("counts diagnostic references to unknown candidates", () => {
    const raw = {
      ...validDraft(),
      diagnostics: [{ code: "unknown", severity: "warning", message: "Unknown", candidateId: "missing" }],
    };
    expect(scoreReconciliation(raw).unknownDiagnosticReferenceCount).toBe(1);
  });

  it("counts malformed decision values rather than throwing", () => {
    const raw = { ...validDraft(), decisions: { "wall-1": "approved" } };
    expect(scoreReconciliation(raw).malformedDecisionCount).toBe(1);
  });

  it("fails closed to explicit counts for a non-object snapshot", () => {
    const score = scoreReconciliation(null);
    expect(score.malformedDecisionCount).toBeGreaterThan(0);
    expect(score.missingPendingDecisionCount).toBe(0);
  });
});
