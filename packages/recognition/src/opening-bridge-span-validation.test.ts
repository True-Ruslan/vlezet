import { describe, expect, it } from "vitest";
import { validateOpeningHypotheses } from "./opening-analysis";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

function wall(endX = 0.3): RecognitionWallCandidate {
  return {
    id: "door-bridge-host",
    start: { x: 0.1, y: 0.5 },
    end: { x: endX, y: 0.5 },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: ["topology-edge"] },
    origin: "local",
    conflict: null,
  };
}

function opening(overrides: Partial<RecognitionOpeningCandidate> = {}): RecognitionOpeningCandidate {
  return {
    id: "door-bridge-opening",
    kind: "door",
    hostWallCandidateId: "door-bridge-host",
    center: { x: 0.2, y: 0.5 },
    widthPx: 200,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: [
        "door-gap-from-bridge",
        "door-leaf-anchored",
        "door-symbol-host-bridge",
      ],
    },
    origin: "local",
    conflict: null,
    ...overrides,
  };
}

describe("door bridge span validation", () => {
  it("accepts a strongly evidenced bridge-derived door whose span equals its topology host", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall()],
      hypotheses: [opening()],
    });

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toEqual([
      expect.objectContaining({
        id: "door-bridge-opening",
        evidence: expect.objectContaining({
          reasons: expect.arrayContaining(["door-bridge-span-validated"]),
        }),
      }),
    ]);
  });

  it("allows at most two pixels of bounded topology rounding at the bridge span", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall(0.2985)],
      hypotheses: [opening({ center: { x: 0.19925, y: 0.5 } })],
    });

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
  });

  it("keeps a generic full-span door behind the ordinary end-margin guard", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall()],
      hypotheses: [opening({
        evidence: { localScore: 0.74, cloudScore: null, reasons: ["door-leaf-anchored"] },
      })],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toEqual([
      expect.objectContaining({ code: "opening-end-margin" }),
    ]);
  });

  it("rejects bridge evidence when the opening exceeds the host by more than two pixels", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall(0.195)],
      hypotheses: [opening({ center: { x: 0.1475, y: 0.5 }, widthPx: 100 })],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toEqual([
      expect.objectContaining({ code: "opening-outside-host-span" }),
    ]);
  });

  it("never applies the bridge-span exception to windows", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall()],
      hypotheses: [opening({ kind: "window" })],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toEqual([
      expect.objectContaining({ code: "opening-end-margin" }),
    ]);
  });
});
