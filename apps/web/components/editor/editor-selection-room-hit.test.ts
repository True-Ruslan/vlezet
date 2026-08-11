import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { entitiesAtPoint } from "./editor-selection-geometry";

function adjacentConcaveRoomsDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
      { id: "c", position: { x: 6000, y: 3000 } },
      { id: "d", position: { x: 6000, y: 6000 } },
      { id: "e", position: { x: 3000, y: 6000 } },
      { id: "f", position: { x: 0, y: 6000 } },
      { id: "g", position: { x: 3000, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "right-top", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "right-bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "bottom-right", startVertexId: "d", endVertexId: "e", junctionVertexIds: [], thickness: 180 },
      { id: "bottom-left", startVertexId: "e", endVertexId: "f", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "f", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
      { id: "inner-vertical", startVertexId: "e", endVertexId: "g", junctionVertexIds: [], thickness: 180 },
      { id: "inner-horizontal", startVertexId: "g", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

describe("room point hit testing", () => {
  it("selects only the small room from the cut-out of an adjacent concave room", () => {
    const document = adjacentConcaveRoomsDocument();
    const rooms = deriveRooms(document).rooms;
    expect(rooms).toHaveLength(2);

    const smallRoom = [...rooms].sort((a, b) => a.areaMm2 - b.areaMm2)[0]!;
    const largeRoom = [...rooms].sort((a, b) => b.areaMm2 - a.areaMm2)[0]!;
    const pointInsideSmallRoom = { x: 4500, y: 4500 };

    const roomHits = entitiesAtPoint(document, pointInsideSmallRoom)
      .filter((ref) => ref.kind === "room");

    expect(roomHits).toEqual([{ kind: "room", id: smallRoom.id }]);
    expect(roomHits).not.toContainEqual({ kind: "room", id: largeRoom.id });
  });

  it("keeps concrete entity priority above a containing room", () => {
    const document = adjacentConcaveRoomsDocument();
    document.placedObjects.push({
      id: "table",
      presetId: null,
      name: "Стол",
      category: "table",
      position: { x: 4500, y: 4500 },
      width: 800,
      depth: 800,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    });

    const hits = entitiesAtPoint(document, { x: 4500, y: 4500 });
    expect(hits[0]).toEqual({ kind: "placed-object", id: "table" });
    expect(hits.some((ref) => ref.kind === "room")).toBe(true);
  });
});
