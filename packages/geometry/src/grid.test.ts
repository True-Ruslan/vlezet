import { describe, expect, it } from "vitest";
import { chooseGridStep } from "./grid";

describe("adaptive grid", () => {
  it("chooses the first step that is at least 28 pixels apart", () => {
    expect(chooseGridStep(0.1)).toBe(500);
    expect(chooseGridStep(0.5)).toBe(100);
    expect(chooseGridStep(2)).toBe(50);
  });

  it("falls back to the largest supported step when zoomed far out", () => {
    expect(chooseGridStep(0.001)).toBe(10000);
  });
});
