import { describe, expect, it } from "vitest";
import { parseCalibrationLength } from "./calibration-input";

describe("calibration length input", () => {
  it("accepts millimetres and metres with comma or dot", () => {
    expect(parseCalibrationLength("1200")).toBe(1200);
    expect(parseCalibrationLength("1200 мм")).toBe(1200);
    expect(parseCalibrationLength("1.2 м")).toBe(1200);
    expect(parseCalibrationLength("1,2m")).toBe(1200);
  });

  it("rejects ambiguous and unsupported values", () => {
    expect(() => parseCalibrationLength("1,2 см")).toThrow();
    expect(() => parseCalibrationLength("50")).toThrow();
    expect(() => parseCalibrationLength("abc")).toThrow();
  });
});
