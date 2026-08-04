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

function consolidateWithMargins(marginPx: number) {
  return consolidateDoorHostWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("left", 430 - marginPx, 300, 430, 300),
      wall("right", 570, 300, 570 + marginPx, 300),
    ],
    symbolSegments: [leaf],
  });
}

describe("door opening eligibility on generated hosts", () => {
  it("keeps a door hypothesis when the generated host has safe end margins", () => {
    const result = consolidateWithMargins(30);

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

  it("suppresses only the opening hypothesis when generated host margins are insufficient", () => {
    const result = consolidateWithMargins(20);

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.openingHypotheses).toEqual([]);
    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]?.openingEligibility).toEqual({
      eligible: false,
      startMarginPx: 20,
      endMarginPx: 20,
      minimumMarginPx: 24,
      reason: "generated-host-end-margin",
    });
    expect(result.diagnostics).toContain("door-opening-host-margin-rejected");

    const host = result.walls.find((candidate) =>
      candidate.id === "local-door-host-left--right");
    expect(host).toBeDefined();
    expect(host?.start).toEqual({ x: 0.41, y: 0.5 });
    expect(host?.end).toEqual({ x: 0.59, y: 0.5 });
  });
});
