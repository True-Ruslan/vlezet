import { describe, expect, it } from "vitest";
import { reconcileRecognition } from "./reconcile";
import type {
  RecognitionDraft,
  RecognitionOpeningCandidate,
  RecognitionProviderResult,
  RecognitionWallCandidate,
} from "./index";

const now = "2026-08-03T00:00:00.000Z";

function wall(origin: "local" | "cloud" = "local"): RecognitionWallCandidate {
  return {
    id: "wall-1",
    start: { x: 0.1, y: 0.5 },
    end: { x: 0.9, y: 0.5 },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: {
      localScore: origin === "local" ? 0.72 : null,
      cloudScore: origin === "cloud" ? 0.91 : null,
      reasons: [origin],
    },
    origin,
    conflict: null,
  };
}

function opening(
  id = "opening-1",
  origin: "local" | "cloud" = "local",
  overrides: Partial<RecognitionOpeningCandidate> = {},
): RecognitionOpeningCandidate {
  return {
    id,
    kind: "door",
    hostWallCandidateId: "wall-1",
    center: { x: 0.5, y: 0.5 },
    widthPx: 100,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: origin === "local" ? 0.72 : null,
      cloudScore: origin === "cloud" ? 0.91 : null,
      reasons: [origin],
    },
    origin,
    conflict: null,
    ...overrides,
  };
}

function draft(): RecognitionDraft {
  return {
    id: "draft",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "revision",
    engineVersion: "5",
    status: "local-complete",
    walls: [wall()],
    openings: [opening()],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "accepted", "opening-1": "accepted" },
    source: { local: true, cloud: false },
    createdAt: now,
    updatedAt: now,
  };
}

function result(openings: readonly RecognitionOpeningCandidate[]): RecognitionProviderResult {
  return { walls: [wall("cloud")], openings, roomLabels: [] };
}

describe("opening reconciliation identity and authority", () => {
  it("does not merge a different cloud id merely because the center is nearby", () => {
    const reconciled = reconcileRecognition({
      localDraft: draft(),
      cloudResult: result([opening("cloud-other", "cloud")]),
      existingWalls: [],
      now,
    });

    expect(reconciled.openings).toEqual([opening()]);
    expect(reconciled.decisions["opening-1"]).toBe("accepted");
    expect(reconciled.decisions).not.toHaveProperty("cloud-other");
    expect(reconciled.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-only-opening-deferred",
      candidateId: "cloud-other",
    }));
  });

  it("promotes an exact local and AI opening classification agreement to high confidence", () => {
    const reconciled = reconcileRecognition({
      localDraft: draft(),
      cloudResult: result([opening("opening-1", "cloud", { kind: "door", confidence: "high" })]),
      existingWalls: [],
      now,
    });

    expect(reconciled.openings[0]).toMatchObject({
      id: "opening-1",
      kind: "door",
      hostWallCandidateId: "wall-1",
      confidence: "high",
      origin: "merged",
      conflict: null,
    });
    expect(reconciled.openings[0]?.evidence.reasons).toContain("local-cloud-opening-agreement");
  });

  it("preserves exact local geometry and decision while accepting cloud reclassification evidence", () => {
    const reconciled = reconcileRecognition({
      localDraft: draft(),
      cloudResult: result([
        opening("opening-1", "cloud", {
          kind: "window",
          confidence: "high",
          center: { x: 0.50001, y: 0.5 },
          widthPx: 100.2,
        }),
      ]),
      existingWalls: [],
      now,
    });

    expect(reconciled.openings[0]).toMatchObject({
      id: "opening-1",
      kind: "window",
      hostWallCandidateId: "wall-1",
      center: { x: 0.5, y: 0.5 },
      widthPx: 100,
      orientationDeg: 0,
      confidence: "medium",
      origin: "merged",
    });
    expect(reconciled.decisions["opening-1"]).toBe("accepted");
  });

  it("does not merge a same-id opening that changes the host wall", () => {
    const reconciled = reconcileRecognition({
      localDraft: draft(),
      cloudResult: result([
        opening("opening-1", "cloud", { hostWallCandidateId: "wall-2" }),
      ]),
      existingWalls: [],
      now,
    });

    expect(reconciled.openings).toEqual([opening()]);
    expect(reconciled.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-opening-host-mismatch",
      candidateId: "opening-1",
    }));
  });
});
