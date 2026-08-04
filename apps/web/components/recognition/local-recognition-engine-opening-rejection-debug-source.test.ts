import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("opening rejection benchmark diagnostics", () => {
  it("exports immutable opening rejections through the existing debug callback", () => {
    expect(source).toContain("OpeningHypothesisRejection");
    expect(source).toContain("openingRejections: readonly OpeningHypothesisRejection[];");
    expect(source).toContain("openingRejections: openingAnalysis.rejections,");
  });
});
