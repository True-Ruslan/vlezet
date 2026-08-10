import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  createRoomStructuralClipboardPayload,
  createStructuralClipboardPayload,
  cutStructuralFragment,
} from "./structural-clipboard";

function twoRoomDocument(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "jt", position: { x: 4000, y: 0 } },
      { id: "b", position: { x: 8000, y: 0 } },
      { id: "c", position: { x: 8000, y: 3000 } },
      { id: "jb", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["jt"], thickness: 200 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: ["jb"], thickness: 200 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
      { id: "partition", startVertexId: "jt", endVertexId: "jb", junctionVertexIds: [], thickness: 120 },
    ],
    openings: [
      { id: "left-window", wallId: "top", kind: "window", offset: 1000, width: 1000 },
      { id: "right-window", wallId: "top", kind: "window", offset: 6000, width: 1000 },
      {
        id: "partition-door",
        wallId: "partition",
        kind: "door",
        offset: 700,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
    ],
    roomAnnotations: [
      { id: "left-room-name", name: "Кабинет", anchor: { x: 2000, y: 1500 } },
    ],
    placedObjects: [],
  };
}

function wallLength(payload: ReturnType<typeof createRoomStructuralClipboardPayload>, wallId: string): number {
  const wall = payload.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`missing wall ${wallId}`);
  const start = payload.vertices.find((vertex) => vertex.id === wall.startVertexId);
  const end = payload.vertices.find((vertex) => vertex.id === wall.endVertexId);
  if (!start || !end) throw new Error(`missing endpoints for ${wallId}`);
  return Math.hypot(end.position.x - start.position.x, end.position.y - start.position.y);
}

describe("M8.2 structural copy projection", () => {
  it("copies one connected wall as a detached self-contained fragment while Cut stays strict", () => {
    const document = twoRoomDocument();
    const before = structuredClone(document);

    const payload = createStructuralClipboardPayload(document, ["top"]);

    expect(payload.walls).toHaveLength(1);
    expect(payload.walls[0]).toMatchObject({ id: "top", junctionVertexIds: [] });
    expect(payload.vertices.map((vertex) => vertex.id)).toEqual(["a", "b"]);
    expect(payload.openings.map((opening) => opening.id)).toEqual(["left-window", "right-window"]);
    expect(payload.roomAnnotations).toEqual([]);
    expect(document).toEqual(before);

    expect(() => cutStructuralFragment(document, ["top"]))
      .toThrow(/весь связанный фрагмент|связан/i);
  });

  it("projects exactly one derived room boundary instead of copying neighbouring wall runs", () => {
    const document = twoRoomDocument();
    const room = deriveRooms(document).rooms.find((candidate) => candidate.name === "Кабинет");
    if (!room) throw new Error("expected annotated left room");

    const payload = createRoomStructuralClipboardPayload(document, room.id);

    expect(payload.scope).toEqual({ kind: "room", sourceRoomId: room.id });
    expect(payload.walls).toHaveLength(4);
    expect(payload.openings.map((opening) => opening.id).sort()).toEqual([
      "left-window",
      "partition-door",
    ]);
    expect(payload.openings.some((opening) => opening.id === "right-window")).toBe(false);
    expect(payload.roomAnnotations).toEqual([
      expect.objectContaining({ id: "left-room-name", name: "Кабинет" }),
    ]);

    const topOpening = payload.openings.find((opening) => opening.id === "left-window");
    if (!topOpening) throw new Error("expected left-room window");
    expect(wallLength(payload, topOpening.wallId)).toBeCloseTo(4000, 8);
  });
});
