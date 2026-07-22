import { describe, expect, it } from "vitest";
import { normalizeOpenRouterRecognitionPayload } from "./openrouter-schema";

describe("OpenRouter recognition payload normalization", () => {
  it("keeps valid candidates when one wall violates the geometric contract", () => {
    const result = normalizeOpenRouterRecognitionPayload({
      walls: [
        {
          id: "good-wall",
          start: { x: 1000, y: 2000 },
          end: { x: 9000, y: 2000 },
          estimatedThicknessPx: 20,
          confidence: "high",
          score: 0.9,
        },
        {
          id: "bad-wall",
          start: { x: 12000, y: 2000 },
          end: { x: 9000, y: 2000 },
          estimatedThicknessPx: 20,
          confidence: "high",
          score: 0.9,
        },
      ],
      openings: [],
      roomLabels: [],
    });

    expect(result.walls.map((wall) => wall.id)).toEqual(["good-wall"]);
    expect(result.diagnostics?.some((item) => item.code === "cloud-invalid-wall" && item.candidateId === "bad-wall")).toBe(true);
  });

  it("still rejects a structurally invalid top-level payload", () => {
    expect(() => normalizeOpenRouterRecognitionPayload({ walls: "not-an-array", openings: [], roomLabels: [] })).toThrow(/списком/i);
  });
});
