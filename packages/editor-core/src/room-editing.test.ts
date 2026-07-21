import { describe, expect, it } from "vitest";
import type { VlezetDocumentV2 } from "@vlezet/domain";
import { deriveRooms, pointInPolygon } from "@vlezet/geometry";
import { setRoomName } from "./room-editing";

const document: VlezetDocumentV2 = {
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
  openings: [],
  roomAnnotations: [],
};

describe("room editing", () => {
  it("creates a persistent annotation at a safe point when a room is named", () => {
    const room = deriveRooms(document).rooms[0]!;
    const updated = setRoomName(document, room.id, "Спальня", "annotation-1");

    expect(updated.roomAnnotations).toHaveLength(1);
    expect(updated.roomAnnotations[0]?.name).toBe("Спальня");
    expect(pointInPolygon(updated.roomAnnotations[0]!.anchor, room.polygon)).toBe(true);
    expect(deriveRooms(updated).rooms[0]?.name).toBe("Спальня");
  });

  it("updates the same annotation instead of duplicating room metadata", () => {
    const room = deriveRooms(document).rooms[0]!;
    const named = setRoomName(document, room.id, "Комната", "annotation-1");
    const renamed = setRoomName(named, room.id, "Кабинет", "annotation-2");

    expect(renamed.roomAnnotations).toHaveLength(1);
    expect(renamed.roomAnnotations[0]?.id).toBe("annotation-1");
    expect(renamed.roomAnnotations[0]?.name).toBe("Кабинет");
  });

  it("rejects empty or unknown room names", () => {
    const room = deriveRooms(document).rooms[0]!;
    expect(() => setRoomName(document, room.id, "   ", "annotation-1")).toThrow();
    expect(() => setRoomName(document, "missing-room", "Кухня", "annotation-1")).toThrow();
  });
});
