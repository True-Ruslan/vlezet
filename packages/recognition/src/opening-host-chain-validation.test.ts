import { describe, expect, it } from "vitest";
import { validateOpeningHypotheses } from "./opening-analysis";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

function wall(
  id: string,
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  overrides: Partial<RecognitionWallCandidate> = {},
): RecognitionWallCandidate {
  return {
    id,
    start,
    end,
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.8, cloudScore: null, reasons: ["test-wall"] },
    origin: "local",
    conflict: null,
    ...overrides,
  };
}

function opening(overrides: Partial<RecognitionOpeningCandidate> = {}): RecognitionOpeningCandidate {
  return {
    id: "opening-chain",
    kind: "door",
    hostWallCandidateId: "host-left",
    center: { x: 0.47, y: 0.5 },
    widthPx: 40,
    orientationDeg: 0,
    confidence: "medium",
    evidence: { localScore: 0.78, cloudScore: null, reasons: ["door-leaf-anchored"] },
    origin: "local",
    conflict: null,
    ...overrides,
  };
}

const host = wall("host-left", { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 });

describe("opening host-chain validation", () => {
  it("accepts an opening near a topology split when an active collinear wall continues the host", () => {
    const continuation = wall("host-right", { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 });

    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [host, continuation],
      hypotheses: [opening()],
    });

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toEqual([
      expect.objectContaining({
        id: "opening-chain",
        hostWallCandidateId: "host-left",
        evidence: expect.objectContaining({
          reasons: expect.arrayContaining(["host-wall-chain-validated"]),
        }),
      }),
    ]);
  });

  it("rejects the same end-margin opening when the collinear gap exceeds the bounded chain limit", () => {
    const distantContinuation = wall("host-right", { x: 0.55, y: 0.5 }, { x: 0.9, y: 0.5 });

    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [host, distantContinuation],
      hypotheses: [opening()],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toEqual([
      expect.objectContaining({ code: "opening-end-margin" }),
    ]);
  });

  it("does not treat a perpendicular junction as a collinear host continuation", () => {
    const perpendicular = wall("junction", { x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 });

    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [host, perpendicular],
      hypotheses: [opening()],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toEqual([
      expect.objectContaining({ code: "opening-end-margin" }),
    ]);
  });

  it("ignores blocked collinear walls when validating a host chain", () => {
    const blockedContinuation = wall(
      "host-right",
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.5 },
      { conflict: "unsupported" },
    );

    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [host, blockedContinuation],
      hypotheses: [opening()],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toEqual([
      expect.objectContaining({ code: "opening-end-margin" }),
    ]);
  });
});
