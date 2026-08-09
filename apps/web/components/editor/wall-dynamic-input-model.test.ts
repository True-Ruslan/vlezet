import { describe, expect, it } from "vitest";
import {
  clampFloatingInputPosition,
  deriveWallDynamicInputKeyAction,
  parseWallAngleInput,
  parseWallLengthInput,
  resolveWallDynamicDraft,
} from "./wall-dynamic-input-model";

describe("M8.2 wall dynamic input model", () => {
  it("keeps ordinary pointer geometry when no exact constraint is active", () => {
    expect(resolveWallDynamicDraft(
      { x: 100, y: 200 },
      { x: 500, y: 500 },
      { lengthMm: null, angleDeg: null },
    )).toMatchObject({
      point: { x: 500, y: 500 },
      lengthMm: 500,
      angleDeg: expect.closeTo(36.8698976458, 8),
    });
  });

  it("locks exact length along the pointer direction", () => {
    const result = resolveWallDynamicDraft(
      { x: 0, y: 0 },
      { x: 300, y: 400 },
      { lengthMm: 1000, angleDeg: null },
    );
    expect(result.lengthMm).toBe(1000);
    expect(result.angleDeg).toBeCloseTo(53.1301023542, 8);
    expect(result.point.x).toBeCloseTo(600, 8);
    expect(result.point.y).toBeCloseTo(800, 8);
  });

  it("locks exact angle while preserving current pointer length", () => {
    const result = resolveWallDynamicDraft(
      { x: 100, y: 200 },
      { x: 400, y: 600 },
      { lengthMm: null, angleDeg: 270 },
    );
    expect(result.lengthMm).toBe(500);
    expect(result.angleDeg).toBe(270);
    expect(result.point).toEqual({ x: 100, y: -300 });
  });

  it("uses exact length and exact Canvas angle together", () => {
    expect(resolveWallDynamicDraft(
      { x: 100, y: 200 },
      { x: 900, y: 900 },
      { lengthMm: 4000, angleDeg: 90 },
    )).toEqual({
      point: { x: 100, y: 4200 },
      lengthMm: 4000,
      angleDeg: 90,
    });
  });

  it("rejects a zero pointer vector when direction must still come from the pointer", () => {
    expect(() => resolveWallDynamicDraft(
      { x: 100, y: 200 },
      { x: 100, y: 200 },
      { lengthMm: 4000, angleDeg: null },
    )).toThrow(RangeError);
  });

  it("accepts human decimal input with comma or dot but rejects zero/non-finite values", () => {
    expect(parseWallLengthInput("4000")).toBe(4000);
    expect(parseWallLengthInput("1250,5")).toBe(1250.5);
    expect(parseWallLengthInput("0")).toBeNull();
    expect(parseWallLengthInput("-20")).toBeNull();
    expect(parseWallLengthInput("Infinity")).toBeNull();
    expect(parseWallLengthInput("abc")).toBeNull();

    expect(parseWallAngleInput("90")).toBe(90);
    expect(parseWallAngleInput("-90")).toBe(270);
    expect(parseWallAngleInput("450,5")).toBe(90.5);
    expect(parseWallAngleInput("NaN")).toBeNull();
  });

  it("clamps the floating editor so authored UI cannot push it outside the Canvas viewport", () => {
    expect(clampFloatingInputPosition(
      { x: 780, y: 580 },
      { width: 180, height: 90 },
      { width: 800, height: 600 },
      8,
    )).toEqual({ x: 612, y: 502 });

    expect(clampFloatingInputPosition(
      { x: -20, y: -10 },
      { width: 180, height: 90 },
      { width: 800, height: 600 },
      8,
    )).toEqual({ x: 8, y: 8 });
  });

  it("keeps Tab native, commits valid Enter and consumes first Escape as numeric cancellation", () => {
    expect(deriveWallDynamicInputKeyAction({ key: "Tab", valid: true })).toBe("native");
    expect(deriveWallDynamicInputKeyAction({ key: "Enter", valid: true })).toBe("commit");
    expect(deriveWallDynamicInputKeyAction({ key: "Enter", valid: false })).toBe("none");
    expect(deriveWallDynamicInputKeyAction({ key: "Escape", valid: false })).toBe("cancel-numeric");
    expect(deriveWallDynamicInputKeyAction({ key: "a", valid: true })).toBe("none");
  });
});
