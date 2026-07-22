import { describe, expect, it } from "vitest";
import { validateRecognitionProviderResult } from "./provider";

describe("recognition provider result validation", () => {
  it("normalizes safe cloud candidates into provider-neutral entities", () => {
    const result = validateRecognitionProviderResult({
      walls: [{ id: "w1", start: { x: 0.1, y: 0.2 }, end: { x: 0.9, y: 0.2 }, estimatedThicknessPx: 18, confidence: "high", score: 0.95 }],
      openings: [{ id: "o1", kind: "door", hostWallCandidateId: "w1", center: { x: 0.5, y: 0.2 }, widthPx: 90, orientationDeg: 0, confidence: "medium", score: 0.7 }],
      roomLabels: [{ id: "r1", text: "Спальня", anchor: { x: 0.5, y: 0.5 }, confidence: "medium" }],
    });
    expect(result.walls[0]?.origin).toBe("cloud");
    expect(result.openings[0]?.kind).toBe("door");
    expect(result.roomLabels[0]?.text).toBe("Спальня");
  });

  it("rejects out-of-range coordinates before reconciliation", () => {
    expect(() => validateRecognitionProviderResult({
      walls: [{ id: "w1", start: { x: -0.01, y: 0 }, end: { x: 1, y: 0 }, estimatedThicknessPx: null, confidence: "high" }],
      openings: [], roomLabels: [],
    })).toThrow();
  });

  it("rejects unsupported opening kinds", () => {
    expect(() => validateRecognitionProviderResult({
      walls: [], openings: [{ id: "o1", kind: "archway", hostWallCandidateId: null, center: { x: 0.5, y: 0.5 }, widthPx: null, orientationDeg: null, confidence: "low" }], roomLabels: [],
    })).toThrow(/kind/i);
  });
});
