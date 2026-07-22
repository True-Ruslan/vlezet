import { describe, expect, it } from "vitest";
import { deriveRectangularRoomDimensions } from "./room-dimensions";
import { deriveRooms } from "./rooms";

function clear3550By3300Rectangle() {
  return {
    schemaVersion: 3 as const,
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
    roomAnnotations: [],
  };
}

describe("rectangular clear room dimensions", () => {
  it("derives the exact clear internal dimensions used by room area", () => {
    const room = deriveRooms(clear3550By3300Rectangle()).rooms[0]!;
    const dimensions = deriveRectangularRoomDimensions(room);

    expect(dimensions).toEqual({ widthMm: 3550, heightMm: 3300 });
    expect(room.areaM2).toBeCloseTo(11.715, 10);
    expect((dimensions!.widthMm * dimensions!.heightMm) / 1_000_000).toBeCloseTo(room.areaM2, 10);
  });

  it("returns null instead of guessing dimensions for a non-rectangular room", () => {
    const dimensions = deriveRectangularRoomDimensions({
      id: "room",
      faceId: "face",
      polygon: [
        { x: 0, y: 0 },
        { x: 3000, y: 0 },
        { x: 2500, y: 2000 },
        { x: 0, y: 2000 },
      ],
      areaMm2: 5_500_000,
      areaM2: 5.5,
      labelPoint: { x: 1000, y: 1000 },
      name: "Комната",
    });

    expect(dimensions).toBeNull();
  });
});
