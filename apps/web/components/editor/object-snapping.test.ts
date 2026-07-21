import { describe, expect, it } from "vitest";
import { snapPlacedObject } from "./object-snapping";

const moving = { id: "moving", position: { x: 0, y: 0 }, width: 1000, depth: 600, rotationDeg: 0 };
const target = { id: "target", position: { x: 2000, y: 1000 }, width: 800, depth: 800, rotationDeg: 0 };

describe("placed object snapping", () => {
  it("prioritizes nearby edge alignment over centre and grid", () => {
    const result = snapPlacedObject({
      rawPosition: { x: 1105, y: 1020 },
      moving,
      others: [target],
      tolerance: 120,
      gridStep: 500,
    });
    expect(result.position.x).toBe(1100);
    expect(result.kind).toBe("edge");
    expect(result.guides).toContainEqual({ axis: "x", value: 1600, source: "edge" });
  });

  it("aligns centres when no edge candidate wins", () => {
    const result = snapPlacedObject({
      rawPosition: { x: 1960, y: 1000 },
      moving,
      others: [target],
      tolerance: 60,
      gridStep: 500,
    });
    expect(result.position).toEqual({ x: 2000, y: 1000 });
    expect(result.kind).toBe("centre");
    expect(result.guides).toEqual(expect.arrayContaining([
      { axis: "x", value: 2000, source: "centre" },
      { axis: "y", value: 1000, source: "centre" },
    ]));
  });

  it("falls back to the adaptive grid", () => {
    expect(snapPlacedObject({
      rawPosition: { x: 1260, y: 1740 },
      moving,
      others: [],
      tolerance: 30,
      gridStep: 500,
    })).toEqual({ position: { x: 1500, y: 1500 }, kind: "grid", guides: [] });
  });

  it("ignores the moving object itself", () => {
    const result = snapPlacedObject({
      rawPosition: { x: 123, y: 234 },
      moving,
      others: [moving],
      tolerance: 100,
      gridStep: 0,
    });
    expect(result).toEqual({ position: { x: 123, y: 234 }, kind: "none", guides: [] });
  });
});
