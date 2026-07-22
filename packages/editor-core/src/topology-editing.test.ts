import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import {
  addTopologicalWall,
  setTopologicalWallLength,
  setWallThickness,
  topologicalWallLength,
} from "./topology-editing";

function rectangleCornerDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
    ],
    walls: [
      { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "bc", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

function singleWallWithOpening(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
    ],
    walls: [
      { id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
    ],
    openings: [
      {
        id: "door",
        wallId: "wall",
        kind: "door",
        offset: 1000,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
    ],
    roomAnnotations: [],
    placedObjects: [],
  };
}

function vertexPosition(document: VlezetDocument, vertexId: string) {
  return document.vertices.find((vertex) => vertex.id === vertexId)?.position;
}

describe("topological wall editing", () => {
  it("creates a first wall with two explicit vertices", () => {
    const result = addTopologicalWall(createEmptyDocument(), {
      wallId: "wall",
      start: { kind: "new-vertex", vertexId: "a", position: { x: 0, y: 0 } },
      end: { kind: "new-vertex", vertexId: "b", position: { x: 3000, y: 0 } },
      thickness: 150,
    });

    expect(result.document.vertices).toHaveLength(2);
    expect(result.document.walls[0]).toEqual({
      id: "wall",
      startVertexId: "a",
      endVertexId: "b",
      junctionVertexIds: [],
      thickness: 150,
    });
    expect(result.continuationVertexId).toBe("b");
  });

  it("reuses an existing vertex when drawing a connected wall", () => {
    const document = rectangleCornerDocument();
    const result = addTopologicalWall(document, {
      wallId: "next",
      start: { kind: "existing-vertex", vertexId: "c" },
      end: { kind: "new-vertex", vertexId: "d", position: { x: 1000, y: 3000 } },
      thickness: 150,
    });

    expect(result.document.vertices).toHaveLength(4);
    expect(result.document.walls.at(-1)?.startVertexId).toBe("c");
  });

  it("creates an explicit T-junction without splitting the semantic host wall", () => {
    const document: VlezetDocument = {
      schemaVersion: 3,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 6000, y: 0 } },
      ],
      walls: [{ id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 }],
      openings: [],
      roomAnnotations: [],
      placedObjects: [],
    };

    const result = addTopologicalWall(document, {
      wallId: "partition",
      start: { kind: "new-vertex", vertexId: "p", position: { x: 3000, y: 2500 } },
      end: { kind: "wall-junction", vertexId: "j", wallId: "host", position: { x: 3000, y: 0 } },
      thickness: 120,
    });

    expect(result.document.walls.find((wall) => wall.id === "host")?.junctionVertexIds).toEqual(["j"]);
    expect(result.document.walls.find((wall) => wall.id === "partition")).toEqual({
      id: "partition",
      startVertexId: "p",
      endVertexId: "j",
      junctionVertexIds: [],
      thickness: 120,
    });
    expect(result.document.walls.filter((wall) => wall.id === "host")).toHaveLength(1);
  });

  it("moves a shared end vertex when exact wall length changes", () => {
    const document = rectangleCornerDocument();
    const resized = setTopologicalWallLength(document, "ab", 8000);
    const b = resized.vertices.find((vertex) => vertex.id === "b");

    expect(b?.position).toEqual({ x: 8000, y: 0 });
    expect(topologicalWallLength(resized, "ab")).toBeCloseTo(8000, 10);
    expect(resized.walls.find((wall) => wall.id === "bc")?.startVertexId).toBe("b");
  });

  it("keeps legacy start-fixed behavior when the anchor is omitted", () => {
    const resized = setTopologicalWallLength(rectangleCornerDocument(), "ab", 8000);
    expect(vertexPosition(resized, "a")).toEqual({ x: 0, y: 0 });
    expect(vertexPosition(resized, "b")).toEqual({ x: 8000, y: 0 });
  });

  it("keeps the end fixed when resizing with the end anchor", () => {
    const resized = setTopologicalWallLength(singleWallWithOpening(), "wall", 5000, "end");
    expect(vertexPosition(resized, "a")).toEqual({ x: -1000, y: 0 });
    expect(vertexPosition(resized, "b")).toEqual({ x: 4000, y: 0 });
  });

  it("keeps the midpoint fixed when resizing with the center anchor", () => {
    const resized = setTopologicalWallLength(singleWallWithOpening(), "wall", 6000, "center");
    expect(vertexPosition(resized, "a")).toEqual({ x: -1000, y: 0 });
    expect(vertexPosition(resized, "b")).toEqual({ x: 5000, y: 0 });
  });

  it("preserves opening world position when the start endpoint moves", () => {
    const resized = setTopologicalWallLength(singleWallWithOpening(), "wall", 5000, "end");
    expect(resized.openings[0]?.offset).toBe(2000);
  });

  it("rejects an end-anchored shrink that would consume an opening", () => {
    expect(() => setTopologicalWallLength(singleWallWithOpening(), "wall", 1500, "end")).toThrow(/проём/i);
  });

  it("rejects shortening a host wall past an internal junction", () => {
    const document: VlezetDocument = {
      schemaVersion: 3,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 6000, y: 0 } },
        { id: "j", position: { x: 4500, y: 0 } },
      ],
      walls: [{ id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 200 }],
      openings: [],
      roomAnnotations: [],
      placedObjects: [],
    };

    expect(() => setTopologicalWallLength(document, "host", 4000)).toThrow(/соедин/i);
  });

  it("updates physical wall thickness without changing topology by default", () => {
    const document = rectangleCornerDocument();
    const updated = setWallThickness(document, "ab", 320);
    expect(updated.walls.find((wall) => wall.id === "ab")?.thickness).toBe(320);
    expect(updated.vertices).toEqual(document.vertices);
  });

  it("keeps the left physical face fixed when thickness changes", () => {
    const document: VlezetDocument = {
      ...createEmptyDocument(),
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 4000, y: 0 } },
      ],
      walls: [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 }],
    };

    const updated = setWallThickness(document, "wall", 300, "left-face");

    expect(vertexPosition(updated, "a")).toEqual({ x: 0, y: -100 });
    expect(vertexPosition(updated, "b")).toEqual({ x: 4000, y: -100 });
    expect(updated.walls[0]?.thickness).toBe(300);
  });

  it("keeps the right physical face fixed when thickness changes", () => {
    const document: VlezetDocument = {
      ...createEmptyDocument(),
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 4000, y: 0 } },
      ],
      walls: [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 }],
    };

    const updated = setWallThickness(document, "wall", 300, "right-face");

    expect(vertexPosition(updated, "a")).toEqual({ x: 0, y: 100 });
    expect(vertexPosition(updated, "b")).toEqual({ x: 4000, y: 100 });
  });

  it("moves an orthogonal junction coherently and preserves a connected-wall opening world position", () => {
    const document: VlezetDocument = {
      ...createEmptyDocument(),
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 6000, y: 0 } },
        { id: "j", position: { x: 3000, y: 0 } },
        { id: "p", position: { x: 3000, y: 3000 } },
      ],
      walls: [
        { id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 100 },
        { id: "partition", startVertexId: "j", endVertexId: "p", junctionVertexIds: [], thickness: 100 },
      ],
      openings: [{ id: "door", wallId: "partition", kind: "door", offset: 1000, width: 900, doorSwing: { hinge: "start", side: "left" } }],
    };

    const updated = setWallThickness(document, "host", 300, "right-face");

    expect(vertexPosition(updated, "a")).toEqual({ x: 0, y: 100 });
    expect(vertexPosition(updated, "b")).toEqual({ x: 6000, y: 100 });
    expect(vertexPosition(updated, "j")).toEqual({ x: 3000, y: 100 });
    expect(updated.openings[0]?.offset).toBe(900);
  });

  it("rejects a face-fixed thickness change that would skew a diagonal connected wall", () => {
    const document: VlezetDocument = {
      ...createEmptyDocument(),
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 4000, y: 0 } },
        { id: "c", position: { x: 5000, y: 1000 } },
      ],
      walls: [
        { id: "target", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
        { id: "diagonal", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      ],
    };

    expect(() => setWallThickness(document, "target", 300, "right-face")).toThrow(/геометр/i);
    expect(vertexPosition(document, "b")).toEqual({ x: 4000, y: 0 });
  });
});
