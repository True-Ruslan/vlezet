import { describe, expect, it } from "vitest";
import { NUDGE_STEP_COARSE_MM, NUDGE_STEP_MM, resolveSelectionNudge } from "./selection-nudge";

describe("M8.4-UX arrow-key selection nudge", () => {
  it("maps each arrow key to a unit-step world delta", () => {
    expect(resolveSelectionNudge({ key: "ArrowLeft", shiftKey: false })).toEqual({ x: -NUDGE_STEP_MM, y: 0 });
    expect(resolveSelectionNudge({ key: "ArrowRight", shiftKey: false })).toEqual({ x: NUDGE_STEP_MM, y: 0 });
    expect(resolveSelectionNudge({ key: "ArrowUp", shiftKey: false })).toEqual({ x: 0, y: -NUDGE_STEP_MM });
    expect(resolveSelectionNudge({ key: "ArrowDown", shiftKey: false })).toEqual({ x: 0, y: NUDGE_STEP_MM });
  });

  it("uses the coarse step while Shift is held", () => {
    expect(resolveSelectionNudge({ key: "ArrowLeft", shiftKey: true })).toEqual({ x: -NUDGE_STEP_COARSE_MM, y: 0 });
    expect(resolveSelectionNudge({ key: "ArrowRight", shiftKey: true })).toEqual({ x: NUDGE_STEP_COARSE_MM, y: 0 });
    expect(resolveSelectionNudge({ key: "ArrowUp", shiftKey: true })).toEqual({ x: 0, y: -NUDGE_STEP_COARSE_MM });
    expect(resolveSelectionNudge({ key: "ArrowDown", shiftKey: true })).toEqual({ x: 0, y: NUDGE_STEP_COARSE_MM });
  });

  it("returns null for any non-arrow key", () => {
    for (const key of ["a", "Enter", "Escape", "Tab", " ", "Shift"]) {
      expect(resolveSelectionNudge({ key, shiftKey: false })).toBeNull();
      expect(resolveSelectionNudge({ key, shiftKey: true })).toBeNull();
    }
  });
});
