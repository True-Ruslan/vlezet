import { describe, expect, it } from "vitest";
import { observeRecognitionApplyTransition, type RecognitionApplyObservation } from "./recognition-apply-transition";

function observation(projectId: string, pastLength: number, lastLabel: string | null): RecognitionApplyObservation {
  return { projectId, pastLength, lastLabel };
}

describe("M7.5 recognition Apply transition", () => {
  it("publishes when the semantic recognition command is appended", () => {
    expect(observeRecognitionApplyTransition(
      observation("p1", 2, "wall/add"),
      observation("p1", 3, "recognition/apply"),
    ).applied).toBe(true);
  });

  it("does not publish for initial load, unrelated commands or project switches", () => {
    expect(observeRecognitionApplyTransition(null, observation("p1", 3, "recognition/apply")).applied).toBe(false);
    expect(observeRecognitionApplyTransition(
      observation("p1", 2, "wall/add"),
      observation("p1", 3, "planning/apply-candidate"),
    ).applied).toBe(false);
    expect(observeRecognitionApplyTransition(
      observation("p1", 2, "wall/add"),
      observation("p2", 3, "recognition/apply"),
    ).applied).toBe(false);
  });
});
