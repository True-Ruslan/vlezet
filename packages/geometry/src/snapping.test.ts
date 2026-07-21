import { describe, expect, it } from "vitest";
import { snapWallPoint } from "./snapping";

const baseInput = { startPoint: { x: 0, y: 0 }, gridStep: 100, tolerance: 60 };

describe("wall snapping", () => {
  it("prefers a nearby endpoint over axis and grid candidates", () => {
    expect(snapWallPoint({ ...baseInput, rawPoint: { x: 990, y: 20 }, endpoints: [{ x: 1025, y: 15 }] })).toEqual({
      point: { x: 1025, y: 15 }, kind: "endpoint", guides: [],
    });
  });

  it("snaps near-horizontal input to the start y coordinate", () => {
    expect(snapWallPoint({ ...baseInput, rawPoint: { x: 943, y: 28 }, endpoints: [] })).toEqual({
      point: { x: 900, y: 0 }, kind: "axis", guides: [{ axis: "y", value: 0 }],
    });
  });

  it("falls back to the nearest grid intersection", () => {
    expect(snapWallPoint({ ...baseInput, rawPoint: { x: 243, y: 267 }, endpoints: [], tolerance: 20 })).toEqual({
      point: { x: 200, y: 300 }, kind: "grid", guides: [],
    });
  });

  it("is deterministic for identical inputs", () => {
    const input = { ...baseInput, rawPoint: { x: 243, y: 267 }, endpoints: [{ x: 500, y: 500 }], tolerance: 20 };
    expect(snapWallPoint(input)).toEqual(snapWallPoint(input));
  });
});
