import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("local recognition door proposal debug contract", () => {
  it("forwards immutable door proposal evidence into benchmark debug", () => {
    expect(source).toContain("doorProposalEvidence: doorHostConsolidation.proposalEvidence");
  });

  it("passes the calibrated analysis scale into door proposal generation", () => {
    expect(source).toContain("millimetersPerPixel: analysisMillimetersPerPixel");
  });
});
