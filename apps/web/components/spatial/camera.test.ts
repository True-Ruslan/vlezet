import { describe, expect, it } from "vitest";
import { deriveCameraPlacement } from "./camera";

const bounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 6000, y: 2700, z: 5000 },
} as const;

describe("deriveCameraPlacement", () => {
  it("centres every preset on the same apartment target", () => {
    for (const preset of ["perspective", "isometric", "top"] as const) {
      expect(deriveCameraPlacement(bounds, preset, 16 / 9).target).toEqual({ x: 3000, y: 1350, z: 2500 });
    }
  });

  it("places top view primarily above the apartment", () => {
    const placement = deriveCameraPlacement(bounds, "top", 1);
    expect(placement.position.y).toBeGreaterThan(placement.target.y);
    expect(Math.abs(placement.position.x - placement.target.x)).toBeLessThan(1);
    expect(Math.abs(placement.position.z - placement.target.z)).toBeLessThan(1);
  });

  it("produces finite clipping planes for empty bounds", () => {
    const placement = deriveCameraPlacement({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, "perspective", 0);
    expect(Number.isFinite(placement.position.x)).toBe(true);
    expect(placement.near).toBeGreaterThan(0);
    expect(placement.far).toBeGreaterThan(placement.near);
  });
});
