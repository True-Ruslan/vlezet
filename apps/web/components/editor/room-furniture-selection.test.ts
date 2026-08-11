import { createEmptyDocument, type PlacedObject, type VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import { selectFurnitureInSelectedRoom } from "./room-furniture-selection";

function object(id: string, x: number, y: number, width = 600, depth = 600): PlacedObject {
  return {
    id,
    presetId: null,
    name: id,
    category: "table",
    position: { x, y },
    width,
    depth,
    rotationDeg: 0,
    clearance: { front: 0, right: 0, back: 0, left: 0 },
  };
}

function roomDocument(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
      { id: "bc", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      { id: "cd", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 100 },
      { id: "da", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 100 },
    ],
    placedObjects: [
      object("inside", 1200, 1000),
      object("touching", 350, 1600),
      object("crossing", 250, 2300),
      object("outside", 5000, 1000),
    ],
  };
}

function roomId(document: VlezetDocument): string {
  const rooms = deriveRooms(document).rooms;
  expect(rooms).toHaveLength(1);
  return rooms[0]!.id;
}

describe("M8.2 explicit room furniture selection", () => {
  it("adds only fully-contained furniture while preserving an explicitly selected crossing object", () => {
    const document = roomDocument();
    const id = roomId(document);
    const initial = addToSelection(
      replaceSelection({ kind: "room", id }),
      [{ kind: "placed-object", id: "crossing" }],
    );

    const result = selectFurnitureInSelectedRoom(document, initial);

    expect(result.refs).toEqual([
      { kind: "room", id },
      { kind: "placed-object", id: "crossing" },
      { kind: "placed-object", id: "inside" },
      { kind: "placed-object", id: "touching" },
    ]);
    expect(result.refs).not.toContainEqual({ kind: "placed-object", id: "outside" });
  });

  it("is deterministic and does not mutate the source selection", () => {
    const document = roomDocument();
    const id = roomId(document);
    const initial = replaceSelection({ kind: "room", id });
    const before = structuredClone(initial);

    const first = selectFurnitureInSelectedRoom(document, initial);
    const second = selectFurnitureInSelectedRoom(document, initial);

    expect(first).toEqual(second);
    expect(initial).toEqual(before);
    expect(first.refs.map((ref) => ref.id)).toEqual([id, "inside", "touching"]);
  });

  it("is a no-op unless the selection has exactly one room root plus optional placed objects", () => {
    const document = roomDocument();
    const id = roomId(document);
    const wallOnly = replaceSelection({ kind: "wall", id: "ab" });
    const roomWithWall = addToSelection(
      replaceSelection({ kind: "room", id }),
      [{ kind: "wall", id: "ab" }],
    );

    expect(selectFurnitureInSelectedRoom(document, wallOnly)).toEqual(wallOnly);
    expect(selectFurnitureInSelectedRoom(document, roomWithWall)).toEqual(roomWithWall);
  });
});
