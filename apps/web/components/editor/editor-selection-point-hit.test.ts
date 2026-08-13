import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { entitiesAtPoint, entitiesIntersectingMarquee } from "./editor-selection-geometry";

function documentFixture(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
      { id: "c", position: { x: 6000, y: 4000 } },
      { id: "d", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 200 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 200 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      createPlacedObject({
        id: "table",
        presetId: null,
        name: "Стол",
        category: "table",
        position: { x: 3000, y: 2000 },
        width: 1000,
        depth: 800,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
    ],
  };
}

describe("M8.1 direct semantic point hit", () => {
  it("returns a derived room for a direct click inside empty room space", () => {
    const document = documentFixture();
    const room = deriveRooms(document).rooms[0]!;

    expect(entitiesAtPoint(document, { x: 1500, y: 2500 })).toEqual([
      { kind: "room", id: room.id },
    ]);
  });

  it("keeps concrete entities ahead of the derived room for point hits and uses the room as a whole-marquee root", () => {
    const document = documentFixture();
    const room = deriveRooms(document).rooms[0]!;

    expect(entitiesAtPoint(document, { x: 3000, y: 2000 })).toEqual([
      { kind: "placed-object", id: "table" },
      { kind: "room", id: room.id },
    ]);

    const marquee = entitiesIntersectingMarquee(document, {
      minX: -1000,
      minY: -1000,
      maxX: 7000,
      maxY: 5000,
    });
    expect(marquee).toEqual([
      { kind: "room", id: room.id },
      { kind: "placed-object", id: "table" },
    ]);
  });
});
