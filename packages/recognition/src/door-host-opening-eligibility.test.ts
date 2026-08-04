import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { consolidateDoorHostWalls } from "./door-host-consolidation";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

const leaf: DetectedLineSegment = { x1: 430, y1: 300, x2: 500, y2: 410 };

function consolidateWithJunctions(leftJunctionX: number, rightJunctionX: number) {
  return consolidateDoorHostWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("left", 100, 300, 430, 300),
      wall("right", 570, 300, 900, 300),
      wall("junction-left", leftJunctionX, 80, leftJunctionX, 520),
      wall("junction-right", rightJunctionX, 80, rightJunctionX, 520),
    ],
    symbolSegments: [leaf],
  });
}

describe("door opening eligibility on generated hosts", () => {
  it("keeps a door hypothesis when the generated host has safe end margins", () => {
    const result = consolidateWithJunctions(400, 600);

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.openingHypotheses).toHaveLength(1);
    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]?.openingEligibility).toEqual({
      eligible: true,
      startMarginPx: 30,
      endMarginPx: 30,
      minimumMarginPx: 24,
      reason: null,
    });
    expect(result.diagnostics).not.toContain("door-opening-host-margin-rejected");
  });

  it("suppresses only the opening hypothesis when the generated host has no end margins", () => {
    const result = consolidateWithJunctions(430, 570);

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.openingHypotheses).toEqual([]);
    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]?.openingEligibility).toEqual({
      eligible: false,
      startMarginPx: 0,
      endMarginPx: 0,
      minimumMarginPx: 24,
      reason: "generated-host-end-margin",
    });
    expect(result.diagnostics).toContain("door-opening-host-margin-rejected");

    const host = result.walls.find((candidate) =>
      candidate.id === "local-door-host-left--right");
    expect(host).toBeDefined();
    expect(host?.start).toEqual({ x: 0.43, y: 0.5 });
    expect(host?.end).toEqual({ x: 0.57, y: 0.5 });
  });
});
