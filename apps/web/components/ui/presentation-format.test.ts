import { describe, expect, it } from "vitest";
import {
  formatDegrees,
  formatMillimeters,
  formatNumberRu,
  formatSquareMeters,
} from "./presentation-format";

const NBSP = "\u00a0";

describe("Russian presentation formatting", () => {
  it("uses Russian decimal separators and bounded precision", () => {
    expect(formatNumberRu(11.715, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe("11,72");
    expect(formatNumberRu(3550)).toBe("3 550");
  });

  it("formats canonical Vlezet units without changing numeric authority", () => {
    expect(formatMillimeters(3550)).toBe(`3 550${NBSP}мм`);
    expect(formatSquareMeters(11.715)).toBe(`11,72${NBSP}м²`);
    expect(formatDegrees(90)).toBe("90°");
  });

  it("fails closed for non-finite presentation values", () => {
    expect(formatMillimeters(Number.NaN)).toBe("—");
    expect(formatSquareMeters(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatDegrees(Number.NEGATIVE_INFINITY)).toBe("—");
  });
});
