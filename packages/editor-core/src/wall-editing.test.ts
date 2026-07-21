import { describe, expect, it } from "vitest";
import { type VlezetDocumentV2 } from "@vlezet/domain";
import { setTopologicalWallLength, topologicalWallLength } from "./topology-editing";

const document: VlezetDocumentV2 = {
  schemaVersion: 2,
  vertices: [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "b", position: { x: 3000, y: 4000 } },
  ],
  walls: [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
  openings: [],
  roomAnnotations: [],
};

describe("topological wall length editing", () => {
  it("keeps the start vertex fixed and preserves direction", () => {
    const resized = setTopologicalWallLength(document, "wall", 10000);
    expect(resized.vertices.find((vertex) => vertex.id === "a")?.position).toEqual({ x: 0, y: 0 });
    expect(resized.vertices.find((vertex) => vertex.id === "b")?.position.x).toBeCloseTo(6000, 10);
    expect(resized.vertices.find((vertex) => vertex.id === "b")?.position.y).toBeCloseTo(8000, 10);
    expect(topologicalWallLength(resized, "wall")).toBeCloseTo(10000, 10);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid requested length %s", (length) => {
    expect(() => setTopologicalWallLength(document, "wall", length)).toThrow(RangeError);
  });
});
