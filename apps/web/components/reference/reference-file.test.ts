import { describe, expect, it } from "vitest";
import {
  MAX_REFERENCE_INPUT_BYTES,
  calculateNormalizedRasterSize,
  detectReferenceFileType,
} from "./reference-file";

describe("reference file validation", () => {
  it("detects PNG, JPEG and PDF by magic bytes", () => {
    expect(detectReferenceFileType(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), 8)).toBe("png");
    expect(detectReferenceFileType(new Uint8Array([0xff,0xd8,0xff,0xdb]), 4)).toBe("jpeg");
    expect(detectReferenceFileType(new TextEncoder().encode("%PDF-1.7"), 8)).toBe("pdf");
  });

  it("rejects unsupported and oversized files", () => {
    expect(() => detectReferenceFileType(new Uint8Array([1,2,3]), 3)).toThrow(/JPG/i);
    expect(() => detectReferenceFileType(new Uint8Array([0xff,0xd8,0xff]), MAX_REFERENCE_INPUT_BYTES + 1)).toThrow(/больш/i);
  });

  it("scales down by longest edge and pixel count without upscaling", () => {
    expect(calculateNormalizedRasterSize(1000, 800)).toEqual({ width: 1000, height: 800, scale: 1 });
    const huge = calculateNormalizedRasterSize(16000, 12000);
    expect(huge.width).toBeLessThanOrEqual(8192);
    expect(huge.width * huge.height).toBeLessThanOrEqual(36_000_000);
  });

  it("rejects tiny sources", () => {
    expect(() => calculateNormalizedRasterSize(150, 1000)).toThrow(/малень/i);
  });
});
