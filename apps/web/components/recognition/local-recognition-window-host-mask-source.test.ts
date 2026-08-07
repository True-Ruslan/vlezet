import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(
  new URL("../../../../packages/recognition/src/structural-clutter-veto-runtime.ts", import.meta.url),
  "utf8",
);

describe("one-sided window host production mask contract", () => {
  it("runs rotated recovery before the existing extension and segmented recovery", () => {
    expect(runtimeSource).toContain("recoverStrongMaskRotatedWalls({");
    expect(runtimeSource).toContain("extendOneSidedWindowHosts({");
    expect(runtimeSource).toContain("structuralMask: input.mask");
    expect(runtimeSource).toContain("const initialExtension = extend(input, rotated.walls)");
    expect(runtimeSource).toContain("wallCandidates: initialExtension.walls");
    expect(runtimeSource).toContain("const finalExtension = extend(input, segmented.walls)");

    const baseIndex = runtimeSource.indexOf("applyStructuralClutterVetoBase(input)");
    const rotatedIndex = runtimeSource.indexOf("recoverStrongMaskRotatedWalls({");
    const initialIndex = runtimeSource.indexOf("const initialExtension = extend(input, rotated.walls)");
    const segmentedIndex = runtimeSource.indexOf("recoverSegmentedBoundaryWalls({");
    const finalIndex = runtimeSource.indexOf("const finalExtension = extend(input, segmented.walls)");
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(baseIndex).toBeLessThan(rotatedIndex);
    expect(rotatedIndex).toBeLessThan(initialIndex);
    expect(initialIndex).toBeLessThan(segmentedIndex);
    expect(segmentedIndex).toBeLessThan(finalIndex);
  });
});
