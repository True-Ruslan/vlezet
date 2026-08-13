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
      createPlacedObject({ id: "sofa", presetId: null, name: "Диван", category: "chair", position: { x: 1500, y: 1600 }, width: 1800, depth: 800, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } }),
      createPlacedObject({ id: "table", presetId: null, name: "Стол", category: "table", position: { x: 3500, y: 1800 }, width: 1000, depth: 700, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } }),
      createPlacedObject({ id: "lamp", presetId: null, name: "Лампа", category: "custom", position: { x: 2500, y: 3000 }, width: 300, depth: 300, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } }),
    ],
  };
}

function idFactory() {
  const counts = new Map<EditorEntityIdKind, number>();
  return (kind: EditorEntityIdKind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `copy-${kind}-${next}`;
  };
}

function storeFor(document = documentFixture()) {
  const store = createEditorStore({ idFactory: idFactory() });
  store.setState({ history: createHistoryState(document) });
  return store;
}

describe("M8.2 explicit composite clipboard", () => {
  it("copies one room plus only explicitly selected furniture", () => {
    const document = documentFixture();
    const room = deriveRooms(document).rooms[0]!;
    const store = storeFor(document);
    store.setState({
      selection: addToSelection(
        replaceSelection({ kind: "room", id: room.id }),
        [
          { kind: "placed-object", id: "sofa" },
          { kind: "placed-object", id: "table" },
        ],
      ),
    });

    const result = store.getState().copySelection();
    expect(result).toEqual({ ok: true });
    const payload = store.getState().clipboard.payload;
    expect(payload?.kind).toBe("composite-selection");
    if (!payload || payload.kind !== "composite-selection") throw new Error("expected composite clipboard");
    expect(payload.structural?.scope).toMatchObject({ kind: "room" });
    expect(payload.objects.map((object) => object.id)).toEqual(["sofa", "table"]);
    expect(payload.objects.some((object) => object.id === "lamp")).toBe(false);
  });

  it("copies explicit walls plus furniture as one composite payload", () => {
    const store = storeFor();
    store.setState({
      selection: addToSelection(
        replaceSelection({ kind: "wall", id: "top" }),
        [{ kind: "placed-object", id: "sofa" }],
      ),
    });

    expect(store.getState().copySelection()).toEqual({ ok: true });
    const payload = store.getState().clipboard.payload;
    expect(payload?.kind).toBe("composite-selection");
    if (!payload || payload.kind !== "composite-selection") throw new Error("expected composite clipboard");
    expect(payload.structural?.walls.map((wall) => wall.id)).toEqual(["top"]);
    expect(payload.objects.map((object) => object.id)).toEqual(["sofa"]);
  });

  it("clears the previous payload when an explicit unsupported copy is rejected", () => {
    const document = documentFixture();
    const room = deriveRooms(document).rooms[0]!;
    const store = storeFor(document);
    store.setState({ selection: replaceSelection({ kind: "wall", id: "top" }) });
    expect(store.getState().copySelection()).toEqual({ ok: true });
    expect(store.getState().clipboard.payload).not.toBeNull();

    store.setState({
      selection: addToSelection(
        replaceSelection({ kind: "room", id: room.id }),
        [{ kind: "wall", id: "top" }],
      ),
    });
    const rejected = store.getState().copySelection();
    expect(rejected.ok).toBe(false);
    expect(store.getState().clipboard.payload).toBeNull();
  });
});