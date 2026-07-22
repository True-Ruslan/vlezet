import { type VlezetDocument } from "@vlezet/domain";
import { deriveRectangularRoomDimensions, deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { setRectangularRoomClearDimension } from "./room-dimension-editing";

function rectangleWithBottomWindow(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 3650, y: 0 } },
      { id: "c", position: { x: 3650, y: 3400 } },
      { id: "d", position: { x: 0, y: 3400 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 100 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [
      { id: "window", wallId: "bottom", kind: "window", offset: 1000, width: 500 },
    ],
    roomAnnotations: [],
    placedObjects: [],
  };
}

function onlyRoomId(document: VlezetDocument): string {
  const room = deriveRooms(document).rooms[0];
  if (!room) throw new Error("Expected one room");
  return room.id;
}

describe("rectangular clear room dimension editing", () => {
  it("sets clear width while keeping the minimum side fixed", () => {
    const document = rectangleWithBottomWindow();
    const roomId = onlyRoomId(document);

    const resized = setRectangularRoomClearDimension(document, roomId, "width", 4000, "min");
    const room = deriveRooms(resized).rooms.find((candidate) => candidate.id === roomId)!;

    expect(deriveRectangularRoomDimensions(room)).toEqual({ widthMm: 4000, heightMm: 3300 });
    expect(room.areaM2).toBeCloseTo(13.2, 10);
    expect(resized.vertices.find((vertex) => vertex.id === "a")?.position).toEqual({ x: 0, y: 0 });
    expect(resized.vertices.find((vertex) => vertex.id === "d")?.position).toEqual({ x: 0, y: 3400 });
    expect(resized.vertices.find((vertex) => vertex.id === "b")?.position).toEqual({ x: 4100, y: 0 });
    expect(resized.vertices.find((vertex) => vertex.id === "c")?.position).toEqual({ x: 4100, y: 3400 });
  });

  it("preserves opening world position on a connecting wall whose start moves", () => {
    const document = rectangleWithBottomWindow();
    const roomId = onlyRoomId(document);

    const resized = setRectangularRoomClearDimension(document, roomId, "width", 4000, "min");

    expect(resized.openings.find((opening) => opening.id === "window")?.offset).toBe(1450);
  });

  it("supports center anchoring for clear width", () => {
    const document = rectangleWithBottomWindow();
    const roomId = onlyRoomId(document);

    const resized = setRectangularRoomClearDimension(document, roomId, "width", 4000, "center");

    expect(resized.vertices.find((vertex) => vertex.id === "a")?.position.x).toBeCloseTo(-225, 10);
    expect(resized.vertices.find((vertex) => vertex.id === "b")?.position.x).toBeCloseTo(3875, 10);
    const room = deriveRooms(resized).rooms.find((candidate) => candidate.id === roomId)!;
    expect(deriveRectangularRoomDimensions(room)?.widthMm).toBeCloseTo(4000, 10);
  });
});
