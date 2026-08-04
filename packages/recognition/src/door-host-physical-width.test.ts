import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { consolidateDoorHostWalls } from "./door-host-consolidation";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(id: string, x1: number, x2: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: 0.5 },
    end: { x: x2 / WIDTH, y: 0.5 },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function leaf(x: number, lengthPx: number): DetectedLineSegment {
  return { x1: x, y1: 300, x2: x, y2: 300 + lengthPx };
}

describe("calibrated door host physical width", () => {
  it("accepts a calibrated architectural door gap", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [wall("left", 100, 455), wall("right", 545, 900)],
      symbolSegments: [leaf(455, 90)],
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.proposalEvidence[0]?.gap.widthPx).toBe(90);
  });

  it("rejects a furniture-sized gap when calibration proves it is wider than a door", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [wall("left", 100, 430), wall("right", 570, 900)],
      symbolSegments: [leaf(430, 140)],
    });

    expect(result.acceptedBridgeCount).toBe(0);
    expect(result.openingHypotheses).toEqual([]);
    expect(result.proposalEvidence).toEqual([]);
    expect(result.diagnostics).toContain("door-gap-physical-width-rejected");
  });

  it("keeps the existing pixel-bounded behavior when calibration is unavailable", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("left", 100, 430), wall("right", 570, 900)],
      symbolSegments: [leaf(430, 140)],
    });

    expect(result.acceptedBridgeCount).toBe(1);
  });

  it("fails closed on an invalid supplied calibration", () => {
    expect(() => consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 0,
      wallCandidates: [wall("left", 100, 455), wall("right", 545, 900)],
      symbolSegments: [leaf(455, 90)],
    })).toThrow("Масштаб изображения должен быть положительным и конечным");
  });
});
