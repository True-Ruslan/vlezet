import { describe, expect, it } from "vitest";
import { deriveVisibleWallIntervals, openingSegment, proposeOpeningPlacement } from "./openings";

const document = {
  schemaVersion: 2 as const,
  vertices: [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "j", position: { x: 3000, y: 0 } },
    { id: "b", position: { x: 6000, y: 0 } },
  ],
  walls: [{ id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 200 }],
  openings: [
    { id: "door", wallId: "host", kind: "door" as const, offset: 500, width: 900, doorSwing: { hinge: "start" as const, side: "left" as const } },
    { id: "window", wallId: "host", kind: "window" as const, offset: 4000, width: 1200 },
  ],
};

describe("opening geometry", () => {
  it("derives visible wall intervals around true opening gaps", () => {
    expect(deriveVisibleWallIntervals(document, "host")).toEqual([
      { startOffset: 0, endOffset: 500 },
      { startOffset: 1400, endOffset: 4000 },
      { startOffset: 5200, endOffset: 6000 },
    ]);
  });

  it("maps an opening offset to exact world coordinates independent of T-junction subdivision", () => {
    const segment = openingSegment(document, document.openings[1]!);
    expect(segment.start).toEqual({ x: 4000, y: 0 });
    expect(segment.end).toEqual({ x: 5200, y: 0 });
    expect(segment.tangent).toEqual({ x: 1, y: 0 });
    expect(segment.leftNormal).toEqual({ x: 0, y: 1 });
  });

  it("centres and clamps placement previews to wall bounds", () => {
    expect(proposeOpeningPlacement(document, "host", 200, 900)).toEqual({ offset: 0, width: 900 });
    expect(proposeOpeningPlacement(document, "host", 3000, 900)).toEqual({ offset: 2550, width: 900 });
    expect(proposeOpeningPlacement(document, "host", 5900, 900)).toEqual({ offset: 5100, width: 900 });
  });
});
