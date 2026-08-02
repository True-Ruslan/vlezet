import { describe, expect, it } from "vitest";
import { isRecognitionCandidateBulkAcceptable } from "./review-selection";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

const wall: RecognitionWallCandidate = {
  id: "wall-1",
  start: { x: 0.1, y: 0.5 },
  end: { x: 0.9, y: 0.5 },
  estimatedThicknessPx: 20,
  confidence: "high",
  evidence: { localScore: 0.8, cloudScore: 0.9, reasons: ["confirmed"] },
  origin: "merged",
  conflict: null,
};

function opening(overrides: Partial<RecognitionOpeningCandidate> = {}): RecognitionOpeningCandidate {
  return {
    id: "opening-1",
    kind: "door",
    hostWallCandidateId: "wall-1",
    center: { x: 0.5, y: 0.5 },
    widthPx: 90,
    orientationDeg: 0,
    confidence: "high",
    evidence: { localScore: 0.7, cloudScore: 0.9, reasons: ["host-wall-validated"] },
    origin: "merged",
    conflict: null,
    ...overrides,
  };
}

describe("recognition bulk acceptance", () => {
  it("accepts an unconflicted high-confidence wall", () => {
    expect(isRecognitionCandidateBulkAcceptable(wall)).toBe(true);
  });

  it("accepts only a classified opening with a surviving host wall", () => {
    expect(isRecognitionCandidateBulkAcceptable(opening())).toBe(true);
    expect(isRecognitionCandidateBulkAcceptable(opening({ kind: "unknown-opening" }))).toBe(false);
    expect(isRecognitionCandidateBulkAcceptable(opening({ hostWallCandidateId: null }))).toBe(false);
  });

  it("rejects medium-confidence and conflicted candidates", () => {
    expect(isRecognitionCandidateBulkAcceptable(opening({ confidence: "medium" }))).toBe(false);
    expect(isRecognitionCandidateBulkAcceptable(opening({ conflict: "invalid-host" }))).toBe(false);
  });
});
