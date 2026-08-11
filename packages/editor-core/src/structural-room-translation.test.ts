import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  evaluateStructuralRoomTranslation,
  resolveStructuralRoomTranslationClosure,
} from "./structural-editing";
import { topologicalWallLength } from "./topology-editing";

function isolatedRoomDocument(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
      { id: "remote-a", position: { x: 10000, y: 10000 } },
      { id: "remote-b", position: { x: 12000, y: 10000 } },
    ],
    walls: [
      { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "bc", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 160 },
      { id: "cd", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "da", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 140 },
      { id: "remote", startVertexId: "remote-a", endVertexId: "remote-b", junctionVertexIds: [], thickness: 120 },
    ],
    openings: [
      {
        id: "door",
        wallId: "ab",
        kind: "door",
        offset: 1200,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
    ],
    roomAnnotations: [
      { id: "room-name", name: "Спальня", anchor: { x: 2000, y: 1500 } },
    ],
  };
}

function adjacentRoomsDocument(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
      { id: "e", position: { x: 8000, y: 0 } },
      { id: "f", position: { x: 8000, y: 3000 } },
    ],
    walls: [
      { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "bc-shared", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "cd", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "da", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
      { id: "be", startVertexId: "b", endVertexId: "e", junctionVertexIds: [], thickness: 180 },
      { id: "ef", startVertexId: "e", endVertexId: "f", junctionVertexIds: [], thickness: 180 },
      { id: "fc", startVertexId: "f", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
    ],
  };
}

function attachedCornerDocument(): VlezetDocument {
  const base = isolatedRoomDocument();
  return {
    ...base,
    vertices: [
      ...base.vertices,
      { id: "outside", position: { x: -2000, y: 0 } },
    ],
    walls: [
      ...base.walls,
      { id: "outside-a", startVertexId: "outside", endVertexId: "a", junctionVertexIds: [], thickness: 120 },
    ],
  };
}

function splitBoundaryDocument(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "j", position: { x: 2000, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
      { id: "outside", position: { x: 2000, y: -1500 } },
    ],
    walls: [
      { id: "ab-host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 180 },
      { id: "bc", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "cd", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "da", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
      { id: "branch", startVertexId: "j", endVertexId: "outside", junctionVertexIds: [], thickness: 120 },
    ],
  };
}

function onlyRoomId(document: VlezetDocument): string {
  const rooms = deriveRooms(document).rooms;
  expect(rooms).toHaveLength(1);
  return rooms[0]!.id;
}

function position(document: VlezetDocument, vertexId: string) {
  return document.vertices.find((vertex) => vertex.id === vertexId)?.position;
}

describe("M8.2 room translation structural authority", () => {
  it("resolves an isolated room to a deterministic complete structural closure", () => {
    const document = isolatedRoomDocument();
    const roomId = onlyRoomId(document);

    const result = resolveStructuralRoomTranslationClosure(document, roomId);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.closure).toEqual({
      roomId,
      vertexIds: ["a", "b", "c", "d"],
      wallIds: ["ab", "bc", "cd", "da"],
      annotationIds: ["room-name"],
    });
  });

  it("rigidly translates an isolated room, annotation and hosted openings without touching unrelated structure", () => {
    const document = isolatedRoomDocument();
    const before = structuredClone(document);
    const roomId = onlyRoomId(document);
    const lengths = new Map(["ab", "bc", "cd", "da"].map((id) => [id, topologicalWallLength(document, id)]));

    const result = evaluateStructuralRoomTranslation(document, roomId, { x: 750, y: -250 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.affectedVertexIds).toEqual(["a", "b", "c", "d"]);
    expect(result.affectedWallIds).toEqual(["ab", "bc", "cd", "da"]);
    expect(position(result.document, "a")).toEqual({ x: 750, y: -250 });
    expect(position(result.document, "b")).toEqual({ x: 4750, y: -250 });
    expect(position(result.document, "c")).toEqual({ x: 4750, y: 2750 });
    expect(position(result.document, "d")).toEqual({ x: 750, y: 2750 });
    expect(position(result.document, "remote-a")).toEqual({ x: 10000, y: 10000 });
    expect(position(result.document, "remote-b")).toEqual({ x: 12000, y: 10000 });
    expect(result.document.openings).toEqual(document.openings);
    expect(result.document.roomAnnotations).toEqual([
      { id: "room-name", name: "Спальня", anchor: { x: 2750, y: 1250 } },
    ]);
    for (const [wallId, length] of lengths) {
      expect(topologicalWallLength(result.document, wallId)).toBe(length);
      expect(result.document.walls.find((wall) => wall.id === wallId)?.thickness)
        .toBe(document.walls.find((wall) => wall.id === wallId)?.thickness);
    }
    expect(document).toEqual(before);
  });

  it("rejects a room whose boundary wall is shared by another bounded face", () => {
    const document = adjacentRoomsDocument();
    const rooms = deriveRooms(document).rooms;
    expect(rooms).toHaveLength(2);
    const leftRoom = rooms.find((room) => room.polygon.some((point) => point.x === 0));
    expect(leftRoom).toBeDefined();

    const closure = resolveStructuralRoomTranslationClosure(document, leftRoom!.id);

    expect(closure.ok).toBe(false);
    if (closure.ok) throw new Error("expected shared-room rejection");
    expect(closure.reason).toMatch(/общ|сосед|связан/i);
  });

  it("rejects a room when an outside wall depends on one of its boundary vertices", () => {
    const document = attachedCornerDocument();
    const roomId = onlyRoomId(document);

    const closure = resolveStructuralRoomTranslationClosure(document, roomId);

    expect(closure.ok).toBe(false);
    if (closure.ok) throw new Error("expected external dependency rejection");
    expect(closure.reason).toMatch(/связан|завис|внеш|общ/i);
  });

  it("rejects a room whose face boundary is only an atomic interval of a split physical wall", () => {
    const document = splitBoundaryDocument();
    const roomId = onlyRoomId(document);

    const closure = resolveStructuralRoomTranslationClosure(document, roomId);

    expect(closure.ok).toBe(false);
    if (closure.ok) throw new Error("expected split-wall rejection");
    expect(closure.reason).toMatch(/част|раздел|стык|связан|границ/i);
  });

  it("treats zero translation as an immutable no-op and rejects an unknown room", () => {
    const document = isolatedRoomDocument();
    const roomId = onlyRoomId(document);

    const noOp = evaluateStructuralRoomTranslation(document, roomId, { x: 0, y: 0 });
    expect(noOp.ok).toBe(true);
    if (!noOp.ok) throw new Error(noOp.reason);
    expect(noOp.document).toBe(document);

    const missing = evaluateStructuralRoomTranslation(document, "missing-room", { x: 10, y: 10 });
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error("expected missing-room rejection");
    expect(missing.code).toBe("invalid-input");
  });
});
