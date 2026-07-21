import { describe, expect, it } from "vitest";
import { extractPlanarFaces } from "./faces";

describe("planar face extraction", () => {
  it("extracts one bounded face from a closed rectangle", () => {
    const faces = extractPlanarFaces({
      schemaVersion: 2,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 4000, y: 0 } },
        { id: "c", position: { x: 4000, y: 3000 } },
        { id: "d", position: { x: 0, y: 3000 } },
      ],
      walls: [
        { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
        { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
        { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 200 },
        { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 200 },
      ],
    });

    expect(faces).toHaveLength(1);
    expect(faces[0]?.signedAreaMm2).toBeCloseTo(12_000_000, 6);
    expect(new Set(faces[0]?.vertexIds)).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("extracts two bounded faces when a partition connects opposite host walls with T-junctions", () => {
    const faces = extractPlanarFaces({
      schemaVersion: 2,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "jt", position: { x: 3000, y: 0 } },
        { id: "b", position: { x: 6000, y: 0 } },
        { id: "c", position: { x: 6000, y: 4000 } },
        { id: "jb", position: { x: 3000, y: 4000 } },
        { id: "d", position: { x: 0, y: 4000 } },
      ],
      walls: [
        { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["jt"], thickness: 200 },
        { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
        { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: ["jb"], thickness: 200 },
        { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 200 },
        { id: "partition", startVertexId: "jt", endVertexId: "jb", junctionVertexIds: [], thickness: 120 },
      ],
    });

    expect(faces).toHaveLength(2);
    expect(faces.map((face) => face.signedAreaMm2).sort((a, b) => a - b)).toEqual([12_000_000, 12_000_000]);
  });

  it("returns no bounded face for an open wall chain", () => {
    expect(extractPlanarFaces({
      schemaVersion: 2,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 3000, y: 0 } },
        { id: "c", position: { x: 3000, y: 3000 } },
      ],
      walls: [
        { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
        { id: "bc", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 150 },
      ],
    })).toEqual([]);
  });
});
