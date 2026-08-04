import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("local recognition window proposal debug contract", () => {
  it("forwards window consolidation input, output and immutable proposal evidence", () => {
    expect(source).toContain("windowHostInputWalls: activeAnalysisWalls");
    expect(source).toContain("windowHostOutputWalls: windowHostConsolidation.walls");
    expect(source).toContain("windowAcceptedBridgeCount: windowHostConsolidation.acceptedBridgeCount");
    expect(source).toContain("windowProposalEvidence: windowHostConsolidation.proposalEvidence");
  });
});
