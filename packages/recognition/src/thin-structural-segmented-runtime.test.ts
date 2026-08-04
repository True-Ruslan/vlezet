import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const runtimeSource = readFileSync(
  new URL("./thin-structural-recovery-runtime.ts", import.meta.url),
  "utf8",
);

describe("segmented boundary production runtime", () => {
  it("routes thin recovery through the segmented boundary postprocessor", () => {
    expect(indexSource).toContain(
      'export { recoverThinStructuralWalls } from "./thin-structural-recovery-runtime"',
    );
    expect(runtimeSource).toContain("recoverSegmentedBoundaryWalls");
    expect(runtimeSource).toContain("base.recoveredWalls");
    expect(runtimeSource).toContain("segmented.recoveredWalls");
  });
});
