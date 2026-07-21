import { describe, expect, it } from "vitest";
import { screenToWorld, worldToScreen, zoomViewportAt } from "./viewport";

describe("viewport transforms", () => {
  it("round-trips world coordinates", () => {
    const viewport = { offsetX: 320, offsetY: 180, pixelsPerMillimeter: 0.25 };
    const world = { x: 1500, y: -750 };
    expect(screenToWorld(worldToScreen(world, viewport), viewport)).toEqual(world);
  });

  it("keeps the world point under the pointer fixed while zooming", () => {
    const viewport = { offsetX: 120, offsetY: 80, pixelsPerMillimeter: 0.2 };
    const anchor = { x: 640, y: 360 };
    const before = screenToWorld(anchor, viewport);
    const zoomed = zoomViewportAt(viewport, anchor, 1.5, { min: 0.01, max: 2 });
    const after = screenToWorld(anchor, zoomed);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });
});
