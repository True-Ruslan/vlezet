import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const runtimeSource = readFileSync(
  new URL("./structural-clutter-veto-runtime.ts", import.meta.url),
  "utf8",
);

describe("segmented boundary production runtime", () => {
  it("runs after rotated wall and door-host recovery, between the two one-sided extension passes", () => {
    expect(indexSource).toContain(
      'export { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery-runtime"',
    );
    expect(indexSource).toContain(
      'export type { SegmentedBoundaryRecoveryResult } from "./segmented-boundary-recovery"',
    );
    expect(indexSource).toContain(
      'export { applyStructuralClutterVeto } from "./structural-clutter-veto-runtime"',
    );
    expect(indexSource).toContain('export * from "./thin-structural-recovery"');
    expect(runtimeSource).toContain("applyStructuralClutterVetoBase");
    expect(runtimeSource).toContain("recoverStrongMaskRotatedWalls");
    expect(runtimeSource).toContain("recoverStrongMaskRotatedDoorHosts");
    expect(runtimeSource).toContain("primaryWalls: rotated.walls");
    expect(runtimeSource).toContain("const initialExtension = extend(input, rotatedDoorHosts.walls)");
    expect(runtimeSource).toContain("recoverSegmentedBoundaryWalls");
    expect(runtimeSource).toContain("wallCandidates: initialExtension.walls");
    expect(runtimeSource).toContain("const finalExtension = extend(input, segmented.walls)");

    const rotatedIndex = runtimeSource.indexOf("recoverStrongMaskRotatedWalls({");
    const doorHostIndex = runtimeSource.indexOf("recoverStrongMaskRotatedDoorHosts({");
    const initialExtensionIndex = runtimeSource.indexOf(
      "const initialExtension = extend(input, rotatedDoorHosts.walls)",
    );
    const segmentedIndex = runtimeSource.indexOf("recoverSegmentedBoundaryWalls({");
    const finalExtensionIndex = runtimeSource.indexOf(
      "const finalExtension = extend(input, segmented.walls)",
    );
    expect(rotatedIndex).toBeGreaterThanOrEqual(0);
    expect(rotatedIndex).toBeLessThan(doorHostIndex);
    expect(doorHostIndex).toBeLessThan(initialExtensionIndex);
    expect(initialExtensionIndex).toBeLessThan(segmentedIndex);
    expect(segmentedIndex).toBeLessThan(finalExtensionIndex);
  });
});
