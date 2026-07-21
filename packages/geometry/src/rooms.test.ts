import { describe, expect, it } from "vitest";
import { deriveRooms } from "./rooms";

function rectangle(thickness = 200) {
  return {
    schemaVersion: 2 as const,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness },
    ],
    roomAnnotations: [],
  };
}

describe("derived rooms", () => {
  it("calculates usable interior area from wall inner faces", () => {
    const result = deriveRooms(rectangle());
    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0]?.polygon).toEqual([
      { x: 100, y: 100 },
      { x: 3900, y: 100 },
      { x: 3900, y: 2900 },
      { x: 100, y: 2900 },
    ]);
    expect(result.rooms[0]?.areaM2).toBeCloseTo(10.64, 10);
  });

  it("uses each boundary wall's own thickness", () => {
    const document = rectangle();
    const result = deriveRooms({
      ...document,
      walls: document.walls.map((wall) => ({
        ...wall,
        thickness: wall.id === "left" || wall.id === "right" ? 400 : 200,
      })),
    });
    expect(result.rooms[0]?.areaM2).toBeCloseTo(10.08, 10);
  });

  it("subtracts partition thickness from both rooms created by a T-to-T partition", () => {
    const result = deriveRooms({
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
      roomAnnotations: [],
    });

    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(result.rooms).toHaveLength(2);
    for (const room of result.rooms) {
      expect(room.areaM2).toBeCloseTo(10.792, 10);
    }
  });

  it("supports a concave L-shaped room", () => {
    const result = deriveRooms({
      schemaVersion: 2,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 5000, y: 0 } },
        { id: "c", position: { x: 5000, y: 2000 } },
        { id: "d", position: { x: 2000, y: 2000 } },
        { id: "e", position: { x: 2000, y: 5000 } },
        { id: "f", position: { x: 0, y: 5000 } },
      ],
      walls: [
        ["ab", "a", "b"], ["bc", "b", "c"], ["cd", "c", "d"],
        ["de", "d", "e"], ["ef", "e", "f"], ["fa", "f", "a"],
      ].map(([id, startVertexId, endVertexId]) => ({ id: id!, startVertexId: startVertexId!, endVertexId: endVertexId!, junctionVertexIds: [], thickness: 200 })),
      roomAnnotations: [],
    });

    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0]!.areaM2).toBeGreaterThan(0);
    expect(result.rooms[0]!.polygon).toHaveLength(6);
  });

  it("does not derive authoritative rooms from invalid crossing topology", () => {
    const base = rectangle();
    const result = deriveRooms({
      ...base,
      vertices: [
        ...base.vertices,
        { id: "e", position: { x: 0, y: 1500 } },
        { id: "f", position: { x: 4000, y: 1500 } },
      ],
      walls: [
        ...base.walls,
        { id: "cross", startVertexId: "e", endVertexId: "f", junctionVertexIds: [], thickness: 120 },
      ],
    });

    expect(result.rooms).toEqual([]);
    expect(result.diagnostics.some((item) => item.severity === "error")).toBe(true);
  });

  it("binds room annotations by anchor containment and warns about orphans", () => {
    const base = rectangle();
    const named = deriveRooms({
      ...base,
      roomAnnotations: [
        { id: "living", name: "Гостиная", anchor: { x: 2000, y: 1500 } },
        { id: "orphan", name: "Старая", anchor: { x: 9000, y: 9000 } },
      ],
    });

    expect(named.rooms[0]?.name).toBe("Гостиная");
    expect(named.rooms[0]?.annotationId).toBe("living");
    expect(named.diagnostics).toContainEqual(expect.objectContaining({ code: "orphan-room-annotation", severity: "warning", annotationId: "orphan" }));
  });
});
