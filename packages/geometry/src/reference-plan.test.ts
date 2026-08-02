import { describe, expect, it } from "vitest";
import {
  alignReferenceCalibration,
  calibrateReferencePlan,
  imagePointToWorld,
  referencePlanBounds,
  worldPointToImage,
} from "./index";

const draft = {
  widthPx: 1000,
  heightPx: 800,
  pointA: { x: 100, y: 200 },
  pointB: { x: 600, y: 200 },
  knownLengthMm: 2500,
  originWorld: { x: 3000, y: 4000 },
};

describe("reference-plan calibration", () => {
  it("calculates a uniform millimetres-per-pixel scale", () => {
    const calibrated = calibrateReferencePlan({ ...draft, alignment: "none" });
    expect(calibrated.transform.millimetersPerPixel).toBeCloseTo(5, 10);
    expect(calibrated.transform.rotationDeg).toBeCloseTo(0, 10);
  });

  it("round-trips points through the similarity transform", () => {
    const transform = {
      originWorld: { x: 1250, y: -700 },
      millimetersPerPixel: 2.5,
      rotationDeg: 31,
    };
    const image = { x: 320, y: 170 };
    const world = imagePointToWorld(image, transform);
    const back = worldPointToImage(world, transform);
    expect(back.x).toBeCloseTo(image.x, 9);
    expect(back.y).toBeCloseTo(image.y, 9);
  });

  it("aligns a segment horizontally while preserving its world midpoint", () => {
    const diagonal = calibrateReferencePlan({
      ...draft,
      pointB: { x: 500, y: 500 },
      alignment: "none",
    });
    const beforeMidpoint = imagePointToWorld({ x: 300, y: 350 }, diagonal.transform);
    const aligned = alignReferenceCalibration(diagonal, "horizontal");
    const afterMidpoint = imagePointToWorld({ x: 300, y: 350 }, aligned.transform);
    const worldA = imagePointToWorld(aligned.calibration.pointA, aligned.transform);
    const worldB = imagePointToWorld(aligned.calibration.pointB, aligned.transform);
    expect(afterMidpoint.x).toBeCloseTo(beforeMidpoint.x, 8);
    expect(afterMidpoint.y).toBeCloseTo(beforeMidpoint.y, 8);
    expect(worldA.y).toBeCloseTo(worldB.y, 8);
  });

  it("treats vertical calibration as an undirected axis", () => {
    const upward = calibrateReferencePlan({
      ...draft,
      pointA: { x: 246, y: 758 },
      pointB: { x: 247, y: 131 },
      knownLengthMm: 6000,
      alignment: "vertical",
    });
    const downward = calibrateReferencePlan({
      ...draft,
      pointA: { x: 247, y: 131 },
      pointB: { x: 246, y: 758 },
      knownLengthMm: 6000,
      alignment: "vertical",
    });

    expect(Math.abs(upward.transform.rotationDeg)).toBeLessThan(1);
    expect(upward.transform.rotationDeg).toBeCloseTo(downward.transform.rotationDeg, 10);
  });

  it("does not flip a reversed horizontal calibration line", () => {
    const forward = calibrateReferencePlan({
      ...draft,
      pointA: { x: 100, y: 200 },
      pointB: { x: 600, y: 200 },
      alignment: "horizontal",
    });
    const reversed = calibrateReferencePlan({
      ...draft,
      pointA: { x: 600, y: 200 },
      pointB: { x: 100, y: 200 },
      alignment: "horizontal",
    });

    expect(forward.transform.rotationDeg).toBe(0);
    expect(reversed.transform.rotationDeg).toBe(0);
  });

  it("derives rotated world bounds", () => {
    const bounds = referencePlanBounds({
      widthPx: 100,
      heightPx: 50,
      transform: {
        originWorld: { x: 0, y: 0 },
        millimetersPerPixel: 10,
        rotationDeg: 90,
      },
    });
    expect(bounds.minX).toBeCloseTo(-500, 8);
    expect(bounds.maxX).toBeCloseTo(0, 8);
    expect(bounds.minY).toBeCloseTo(0, 8);
    expect(bounds.maxY).toBeCloseTo(1000, 8);
  });

  it("rejects unstable calibration inputs", () => {
    expect(() => calibrateReferencePlan({ ...draft, pointB: { x: 110, y: 200 }, alignment: "none" })).toThrow();
    expect(() => calibrateReferencePlan({ ...draft, knownLengthMm: 50, alignment: "none" })).toThrow();
  });
});
