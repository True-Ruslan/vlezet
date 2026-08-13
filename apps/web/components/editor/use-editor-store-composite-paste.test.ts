import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import { createEditorStore, type EditorEntityIdKind } from "./use-editor-store";

function documentFixture(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 5000, y: 0 } },
      { id: "c", position: { x: 5000, y: 4000 } },
      { id: "d", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [{ id: "door", wallId: "top", kind: "door", offset: 1200, width: 900 }],
    roomAnnotations: [],
    placedObjects: [
      createPlacedObject({
        id: "chair",
        presetId: null,
        name: "Стул",
        category: "chair",
        position: { x: 1800, y: 1800 },
        width: 600,
        depth: 600,
        rotationDeg: 15,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
    ],
  };
}

function deterministicIds() {
  const counts = new Map<EditorEntityIdKind, number>();
  return (kind: EditorEntityIdKind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `copy-${kind}-${next}`;
  };
}

function preparedCompositeStore() {
  const document = documentFixture();
  const room = deriveRooms(document).rooms[0]!;
  const store = createEditorStore({ idFactory: deterministicIds() });
  store.setState({
    history: createHistoryState(document),
    selection: addToSelection(
      replaceSelection({ kind: "room", id: room.id }),
      [{ kind: "placed-object", id: "chair" }],
    ),
  });
  expect(store.getState().copySelection()).toEqual({ ok: true });
  const payload = store.getState().clipboard.payload;
  expect(payload?.kind).toBe("composite-selection");
  if (!payload || payload.kind !== "composite-selection" || !payload.structural) {
    throw new Error("Expected structural composite clipboard payload");
  }
  return { store, payload };
}

describe("M8.2 atomic composite paste", () => {
  it("pastes structure and explicit furniture with one actual structural delta and one history command", () => {
    const { store, payload } = preparedCompositeStore();
    const before = structuredClone(store.getState().history.document);
    const sourceObject = before.placedObjects.find((object) => object.id === "chair")!;
    const sourceVertex = payload.structural!.vertices[0]!;

    // Requesting the original group anchor collides with the source room. The canonical
    // structural paste must choose a safe fallback and the object must follow that exact delta.
    const anchor = { ...payload.copiedAtOrigin };
    store.getState().pasteClipboard(anchor);

    let state = store.getState();
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("selection/paste-composite");
    expect(state.history.document.walls).toHaveLength(before.walls.length + payload.structural!.walls.length);
    expect(state.history.document.placedObjects).toHaveLength(before.placedObjects.length + 1);

    const pastedVertex = state.history.document.vertices.find((vertex) => vertex.id === "copy-vertex-1");
    const pastedObject = state.history.document.placedObjects.find((object) => object.id === "copy-placed-object-1");
    expect(pastedVertex).toBeDefined();
    expect(pastedObject).toBeDefined();
    const appliedDelta = {
      x: pastedVertex!.position.x - sourceVertex.position.x,
      y: pastedVertex!.position.y - sourceVertex.position.y,
    };
    expect(appliedDelta).not.toEqual({ x: 0, y: 0 });
    expect(pastedObject!.position).toEqual({
      x: sourceObject.position.x + appliedDelta.x,
      y: sourceObject.position.y + appliedDelta.y,
    });

    expect(state.selection.refs).toEqual(expect.arrayContaining([
      { kind: "wall", id: "copy-wall-1" },
      { kind: "placed-object", id: "copy-placed-object-1" },
    ]));
    expect(state.clipboard.payload).toEqual(payload);
    expect(state.clipboard.lastPasteAnchor).toEqual(anchor);
    expect(state.clipboard.repeatedPasteCount).toBe(1);

    const after = structuredClone(state.history.document);
    store.getState().undo();
    state = store.getState();
    expect(state.history.document).toEqual(before);

    store.getState().redo();
    state = store.getState();
    expect(state.history.document).toEqual(after);
  });

  it("rejects a malformed composite structural paste without partial document, history, selection or clipboard mutation", () => {
    const { store, payload } = preparedCompositeStore();
    const structural = payload.structural!;
    const invalidPayload = {
      ...payload,
      structural: {
        ...structural,
        walls: structural.walls.map((wall, index) => index === 0
          ? { ...wall, startVertexId: "missing-external-vertex" }
          : wall),
      },
    } as typeof payload;
    store.setState({
      clipboard: {
        payload: invalidPayload,
        lastPasteAnchor: null,
        repeatedPasteCount: 0,
      },
    });

    const beforeDocument = structuredClone(store.getState().history.document);
    const beforePast = structuredClone(store.getState().history.past);
    const beforeFuture = structuredClone(store.getState().history.future);
    const beforeSelection = structuredClone(store.getState().selection);
    const beforeClipboard = structuredClone(store.getState().clipboard);

    store.getState().pasteClipboard({ ...payload.copiedAtOrigin });

    const state = store.getState();
    expect(state.history.document).toEqual(beforeDocument);
    expect(state.history.past).toEqual(beforePast);
    expect(state.history.future).toEqual(beforeFuture);
    expect(state.selection).toEqual(beforeSelection);
    expect(state.clipboard).toEqual(beforeClipboard);
  });
});
