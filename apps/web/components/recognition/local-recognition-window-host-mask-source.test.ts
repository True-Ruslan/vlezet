import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("one-sided window host production mask contract", () => {
  it("passes the structural mask into window host consolidation", () => {
    expect(source).toContain("structuralMask: structuralMaskView");
  });
});
