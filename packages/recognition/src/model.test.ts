import { describe, expect, it } from "vitest";
import {
  validateNormalizedPoint,
  validateRecognitionDraft,
  validateRecognitionSession,
  type RecognitionDraft,
} from "./model";

function draftFixture(): RecognitionDraft {
  return {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "1",
    status: "local-complete",
    walls: [
      {
        id: "wall-1",
        start: { x: 0, y: 0.25 },
        end: { x: 1, y: 0.25 },
        estimatedThicknessPx: 18,
        confidence: "high",
        evidence: { localScore: 0.94, cloudScore: null, reasons: ["parallel-edges"] },
        origin: "local",
        conflict: null,
      },
    ],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending" },
    source: { local: true, cloud: false },
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  };
}

describe("recognition model validation", () => {
  it("accepts inclusive normalized coordinate boundaries", () => {
    expect(validateNormalizedPoint({ x: 0, y: 1 })).toEqual({ x: 0, y: 1 });
  });

  it.each([
    { x: -0.001, y: 0 },
    { x: 1.001, y: 0 },
    { x: Number.NaN, y: 0 },
    { x: 0, y: Number.POSITIVE_INFINITY },
  ])("rejects invalid normalized point %#", (point) => {
    expect(() => validateNormalizedPoint(point)).toThrow();
  });

  it("rejects decisions that reference unknown candidates", () => {
    const draft = draftFixture();
    expect(() => validateRecognitionDraft({ ...draft, decisions: { ...draft.decisions, ghost: "accepted" } })).toThrow();
  });

  it("requires stable reference revision on sessions", () => {
    const draft = draftFixture();
    expect(() => validateRecognitionSession({
      id: "session-1",
      projectId: draft.projectId,
      referenceAssetId: draft.referenceAssetId,
      referenceRevision: "",
      engineVersion: draft.engineVersion,
      draft,
      cloudMetadata: null,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    })).toThrow();
  });
});
