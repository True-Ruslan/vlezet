import { describe, expect, it } from "vitest";
import { enforceLocalWallReviewBudget } from "./review-budget";
import type { RecognitionWallCandidate } from "./model";

function wall(id: string): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y: 0.1 },
    end: { x: 0.9, y: 0.1 },
    estimatedThicknessPx: 20,
    confidence: "medium",
    origin: "local",
    conflict: null,
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["test"] },
  };
}

describe("local recognition review budget", () => {
  it("preserves a reviewable candidate set", () => {
    const walls = [wall("w1"), wall("w2")];

    expect(enforceLocalWallReviewBudget({ walls, maximumWalls: 2 })).toEqual({
      walls,
      overloaded: false,
      originalWallCount: 2,
      droppedWallCount: 0,
    });
  });

  it("fails closed instead of exposing an unreviewable wall explosion", () => {
    const walls = Array.from({ length: 81 }, (_, index) => wall(`w${index}`));

    expect(enforceLocalWallReviewBudget({ walls, maximumWalls: 80 })).toEqual({
      walls: [],
      overloaded: true,
      originalWallCount: 81,
      droppedWallCount: 81,
    });
  });

  it("rejects a non-positive or fractional budget", () => {
    expect(() => enforceLocalWallReviewBudget({ walls: [], maximumWalls: 0 })).toThrow();
    expect(() => enforceLocalWallReviewBudget({ walls: [], maximumWalls: 1.5 })).toThrow();
  });
});
