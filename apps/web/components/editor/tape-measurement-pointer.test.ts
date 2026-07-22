import { describe, expect, it } from "vitest";
import { shouldHandleTapePointer } from "./tape-measurement-pointer";

describe("tape measurement pointer gating", () => {
  it("handles an ordinary left click", () => {
    expect(shouldHandleTapePointer({ commit: true, button: 0, buttons: 1, spacePressed: false, hasMeasurement: false, measurementComplete: false })).toBe(true);
  });

  it("does not intercept middle-button or Space+left pan starts", () => {
    expect(shouldHandleTapePointer({ commit: true, button: 1, buttons: 4, spacePressed: false, hasMeasurement: true, measurementComplete: false })).toBe(false);
    expect(shouldHandleTapePointer({ commit: true, button: 0, buttons: 1, spacePressed: true, hasMeasurement: true, measurementComplete: false })).toBe(false);
  });

  it("previews only on hover, never while a drag gesture is active", () => {
    expect(shouldHandleTapePointer({ commit: false, button: 0, buttons: 0, spacePressed: false, hasMeasurement: true, measurementComplete: false })).toBe(true);
    expect(shouldHandleTapePointer({ commit: false, button: 0, buttons: 4, spacePressed: false, hasMeasurement: true, measurementComplete: false })).toBe(false);
    expect(shouldHandleTapePointer({ commit: false, button: 0, buttons: 1, spacePressed: true, hasMeasurement: true, measurementComplete: false })).toBe(false);
  });

  it("does not preview without an incomplete measurement", () => {
    expect(shouldHandleTapePointer({ commit: false, button: 0, buttons: 0, spacePressed: false, hasMeasurement: false, measurementComplete: false })).toBe(false);
    expect(shouldHandleTapePointer({ commit: false, button: 0, buttons: 0, spacePressed: false, hasMeasurement: true, measurementComplete: true })).toBe(false);
  });
});
