import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("one-sided window host production mask contract", () => {
  it("passes the structural mask specifically into window host consolidation", () => {
    expect(source).toContain(`const windowHostConsolidation = consolidateWindowHostWalls({
      widthPx: input.imageData.width,
      heightPx: input.imageData.height,
      structuralMask: structuralMaskView,`);
  });
});
