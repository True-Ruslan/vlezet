import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("M7.10 door host consolidation integration", () => {
  it("runs symbol-confirmed door bridging after window bridging and before topology sanity", () => {
    expect(source).toContain("consolidateDoorHostWalls");
    expect(source).toContain("const doorHostConsolidation = consolidateDoorHostWalls({");
    expect(source).toContain("wallCandidates: windowHostConsolidation.walls");
    expect(source).toContain("wallCandidates: doorHostConsolidation.walls");
    const windowBridge = source.indexOf("const windowHostConsolidation = consolidateWindowHostWalls({");
    const doorBridge = source.indexOf("const doorHostConsolidation = consolidateDoorHostWalls({");
    const topology = source.indexOf("const topologySanity = sanitizeRecognitionWallTopology({");
    expect(doorBridge).toBeGreaterThan(windowBridge);
    expect(topology).toBeGreaterThan(doorBridge);
  });

  it("records bounded bridge evidence without auto-applying geometry", () => {
    expect(source).toContain("doorAcceptedBridgeCount");
    expect(source).toContain("doorHostDiagnosticCodes");
    expect(source).toContain('code: "door-symbol-host-consolidation"');
    expect(source).toContain('code: "door-host-consolidation-budget"');
    expect(source).not.toContain("autoApplyDoorHosts");
  });
});
