import { describe, expect, it } from "vitest";
import { deriveAtomicWallEdges } from "./topology";

const document = {
  schemaVersion: 2 as const,
  vertices: [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "b", position: { x: 6000, y: 0 } },
    { id: "j1", position: { x: 2000, y: 0 } },
    { id: "j2", position: { x: 4500, y: 0 } },
  ],
  walls: [
    {
      id: "wall",
      startVertexId: "a",
      endVertexId: "b",
      junctionVertexIds: ["j2", "j1"],
      thickness: 180,
    },
  ],
};

describe("atomic wall topology", () => {
  it("orders internal junctions by distance along the semantic wall run", () => {
    expect(deriveAtomicWallEdges(document)).toEqual([
      {
        wallId: "wall",
        startVertexId: "a",
        endVertexId: "j1",
        start: { x: 0, y: 0 },
        end: { x: 2000, y: 0 },
        thickness: 180,
        startOffset: 0,
        endOffset: 2000,
      },
      {
        wallId: "wall",
        startVertexId: "j1",
        endVertexId: "j2",
        start: { x: 2000, y: 0 },
        end: { x: 4500, y: 0 },
        thickness: 180,
        startOffset: 2000,
        endOffset: 4500,
      },
      {
        wallId: "wall",
        startVertexId: "j2",
        endVertexId: "b",
        start: { x: 4500, y: 0 },
        end: { x: 6000, y: 0 },
        thickness: 180,
        startOffset: 4500,
        endOffset: 6000,
      },
    ]);
  });
});
