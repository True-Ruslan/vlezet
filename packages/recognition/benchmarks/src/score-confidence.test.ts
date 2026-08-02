import { describe, expect, it } from "vitest";
import { scoreConfidence } from "./score-confidence";

describe("recognition benchmark confidence scoring", () => {
  it("counts incorrect high-confidence predictions", () => {
    expect(scoreConfidence({
      matchedPredictionKeys: new Set(["wall:0"]),
      predictions: [
        { key: "wall:0", confidence: "high" },
        { key: "wall:1", confidence: "high" },
      ],
    })).toMatchObject({
      highConfidenceTruePositiveCount: 1,
      highConfidenceFalsePositiveCount: 1,
      incorrectHighConfidenceRate: 0.5,
    });
  });

  it("returns zero rather than NaN when there are no high-confidence predictions", () => {
    const score = scoreConfidence({
      matchedPredictionKeys: new Set(["wall:0"]),
      predictions: [{ key: "wall:0", confidence: "medium" }],
    });
    expect(score.incorrectHighConfidenceRate).toBe(0);
    expect(Number.isFinite(score.incorrectHighConfidenceRate)).toBe(true);
  });

  it("fails closed on duplicate prediction keys", () => {
    expect(() => scoreConfidence({
      matchedPredictionKeys: new Set(),
      predictions: [
        { key: "same", confidence: "low" },
        { key: "same", confidence: "high" },
      ],
    })).toThrow();
  });
});
