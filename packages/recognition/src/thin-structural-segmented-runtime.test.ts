import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const runtimeSource = readFileSync(
  new URL("./structural-clutter-veto-runtime.ts", import.meta.url),
  "utf8",
);

describe("segmented boundary production runtime", () => {
  it("runs segmented recovery after base clutter processing", () => {
    expect(indexSource).toContain(
      'export { applyStructuralClutterVeto } from "./structural-clutter-veto-runtime"',
    );
    expect(indexSource).toContain('export * from "./thin-structural-recovery"');
    expect(runtimeSource).toContain("applyStructuralClutterVetoBase");
    expect(runtimeSource).toContain("recoverSegmentedBoundaryWalls");
    expect(runtimeSource).toContain("wallCandidates: base.walls");
    expect(runtimeSource).toContain("wallCandidates: segmented.walls");
  });
});
