import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("region-first opening gap preservation source contract", () => {
  it("passes the structural mask only into the region-first wall analysis", () => {
    expect(source).toContain("structuralMask: structuralMaskView");
  });
});
