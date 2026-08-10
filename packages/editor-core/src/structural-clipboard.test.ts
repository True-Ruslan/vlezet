import { createEmptyDocument, type Point2, type VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import {
  createStructuralClipboardPayload,
  cutStructuralFragment,
  evaluateStructuralClipboardClosure,
  pasteStructuralFragment,
} from "./structural-clipboard";

function closedRoomWithOpening(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 160 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 140 },
    ],
    openings: [
      {
        id: "door",
        wallId: "top",
        kind: "door",
        offset: 1000,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
      {
        id: "window",
        wallId: "right",
        kind: "window",
        offset: 800,
        width: 1200,
      },
    ],
  };
}

function deterministicIds() {
  const counts = { vertex: 0, wall: 0, opening: 0, "room-annotation": 0 };
  return (kind: keyof typeof counts) => `${kind}-copy-${++counts[kind]}`;
}

function byId(document: VlezetDocument, vertexId: string): Point2 {
  const vertex = document.vertices.find((candidate) => candidate.id === vertexId);
  if (!vertex) throw new Error(`missing vertex ${vertexId}`);
  return vertex.position;
}

describe("M8.2 strict structural clipboard", () => {
  it("accepts a complete wall closure in source-document order", () => {
    const document = closedRoomWithOpening();

    const result = evaluateStructuralClipboardClosure(
      document,
      ["bottom", "top", "left", "right"],
    );

    expect(result).toEqual({
      ok: true,
      wallIds: ["top", "right", "bottom", "left"],
      vertexIds: ["a", "b", "c", "d"],
      openingIds: ["door", "window"],
    });
  });

  it("rejects an incomplete connected wall selection without enlarging it", () => {
    const document = closedRoomWithOpening();
    const selection = ["top"] as const;
    const beforeSelection = [...selection];

    const result = evaluateStructuralClipboardClosure(document, selection);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected open closure rejection");
    expect(result.reason).toMatch(/связан|фрагмент|стен/i);
    expect(selection).toEqual(beforeSelection);
  });

  it("rejects empty, duplicate and missing wall selections deterministically", () => {
    const document = closedRoomWithOpening();

    expect(evaluateStructuralClipboardClosure(document, [])).toMatchObject({ ok: false });
    expect(evaluateStructuralClipboardClosure(document, ["top", "top"])).toMatchObject({ ok: false });
    expect(evaluateStructuralClipboardClosure(document, ["missing"])).toMatchObject({ ok: false });
  });

  it("includes every hosted opening automatically and keeps payload source order", () => {
    const document = closedRoomWithOpening();
    const before = structuredClone(document);

    const payload = createStructuralClipboardPayload(
      document,
      ["top", "right", "bottom", "left"],
    );

    expect(payload).toMatchObject({
      version: 1,
      kind: "structural-fragment",
      scope: { kind: "walls" },
      origin: { x: 0, y: 0 },
      roomAnnotations: [],
    });
    expect(payload.vertices.map((vertex) => vertex.id)).toEqual(["a", "b", "c", "d"]);
    expect(payload.walls.map((wall) => wall.id)).toEqual(["top", "right", "bottom", "left"]);
    expect(payload.openings.map((opening) => opening.id)).toEqual(["door", "window"]);
    expect(payload.openings.map((opening) => opening.wallId)).toEqual(["top", "right"]);
    expect(document).toEqual(before);
  });

  it("cuts one complete fragment atomically without dangling structural references", () => {
    const document = closedRoomWithOpening();
    const before = structuredClone(document);

    const result = cutStructuralFragment(
      document,
      ["top", "right", "bottom", "left"],
    );

    expect(result.document.walls).toEqual([]);
    expect(result.document.vertices).toEqual([]);
    expect(result.document.openings).toEqual([]);
    expect(result.payload.walls).toHaveLength(4);
    expect(result.payload.openings).toHaveLength(2);
    expect(document).toEqual(before);
  });

  it("pastes a rigid translated fragment with fresh IDs and remapped references", () => {
    const source = closedRoomWithOpening();
    const payload = createStructuralClipboardPayload(
      source,
      ["top", "right", "bottom", "left"],
    );

    const result = pasteStructuralFragment(
      source,
      payload,
      { x: 6000, y: 500 },
      deterministicIds(),
    );

    expect(result.vertexIds).toEqual([
      "vertex-copy-1",
      "vertex-copy-2",
      "vertex-copy-3",
      "vertex-copy-4",
    ]);
    expect(result.wallIds).toEqual(["wall-copy-1", "wall-copy-2", "wall-copy-3", "wall-copy-4"]);
    expect(result.openingIds).toEqual(["opening-copy-1", "opening-copy-2"]);
    expect(result.roomAnnotationIds).toEqual([]);

    const pastedWalls = result.document.walls.filter((wall) => result.wallIds.includes(wall.id));
    expect(pastedWalls[0]).toMatchObject({
      id: "wall-copy-1",
      startVertexId: "vertex-copy-1",
      endVertexId: "vertex-copy-2",
      thickness: 200,
    });
    expect(pastedWalls[1]).toMatchObject({
      id: "wall-copy-2",
      startVertexId: "vertex-copy-2",
      endVertexId: "vertex-copy-3",
      thickness: 180,
    });

    expect(byId(result.document, "vertex-copy-1")).toEqual({ x: 6000, y: 500 });
    expect(byId(result.document, "vertex-copy-2")).toEqual({ x: 10000, y: 500 });
    expect(byId(result.document, "vertex-copy-3")).toEqual({ x: 10000, y: 3500 });
    expect(byId(result.document, "vertex-copy-4")).toEqual({ x: 6000, y: 3500 });

    const pastedOpenings = result.document.openings.filter((opening) => result.openingIds.includes(opening.id));
    expect(pastedOpenings).toEqual([
      expect.objectContaining({ id: "opening-copy-1", wallId: "wall-copy-1", offset: 1000, width: 900 }),
      expect.objectContaining({ id: "opening-copy-2", wallId: "wall-copy-2", offset: 800, width: 1200 }),
    ]);
  });

  it("rejects an invalid overlapping paste atomically and never mutates source or payload", () => {
    const document = closedRoomWithOpening();
    const payload = createStructuralClipboardPayload(
      document,
      ["top", "right", "bottom", "left"],
    );
    const beforeDocument = structuredClone(document);
    const beforePayload = structuredClone(payload);

    expect(() => pasteStructuralFragment(
      document,
      payload,
      { x: 0, y: 0 },
      deterministicIds(),
    )).toThrow(/стен|геометр|перес|наклад/i);

    expect(document).toEqual(beforeDocument);
    expect(payload).toEqual(beforePayload);
  });
});