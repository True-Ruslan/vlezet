import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("local recognition topology continuity integration", () => {
  it("passes the structural mask into topology sanitation", () => {
    expect(source).toContain("const topologySanity = sanitizeRecognitionWallTopology({");
    expect(source).toContain("structuralMask: structuralMaskView");
  });
});
