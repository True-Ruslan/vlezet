import { describe, expect, it } from "vitest";
import { deriveSingleAdjacentRoomSide } from "./wall-room-side";

function rectangle() {
  return {
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 100 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 100 },
    ],
  };
}

describe("wall room side", () => {
  it("derives the unique interior side for an outer rectangle wall", () => {
    expect(deriveSingleAdjacentRoomSide(rectangle(), "top")).toBe("left");
  });

  it("respects semantic wall direction", () => {
    const document = rectangle();
    const reversed = {
      ...document,
      walls: document.walls.map((wall) => wall.id === "top"
        ? { ...wall, startVertexId: "b", endVertexId: "a" }
        : wall),
    };
    expect(deriveSingleAdjacentRoomSide(reversed, "top")).toBe("right");
  });

  it("returns null for a partition with rooms on both sides", () => {
    const document = {
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "jt", position: { x: 3000, y: 0 } },
        { id: "b", position: { x: 6000, y: 0 } },
        { id: "c", position: { x: 6000, y: 4000 } },
        { id: "jb", position: { x: 3000, y: 4000 } },
        { id: "d", position: { x: 0, y: 4000 } },
      ],
      walls: [
        { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["jt"], thickness: 100 },
        { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
        { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: ["jb"], thickness: 100 },
        { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 100 },
        { id: "partition", startVertexId: "jt", endVertexId: "jb", junctionVertexIds: [], thickness: 100 },
      ],
    };

    expect(deriveSingleAdjacentRoomSide(document, "partition")).toBeNull();
  });
});
