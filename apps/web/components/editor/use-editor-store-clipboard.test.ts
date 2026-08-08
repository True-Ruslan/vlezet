import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection, type EditorSelection } from "./editor-selection";
import { createEditorStore, type EditorEntityIdKind } from "./use-editor-store";

function documentWithFurniture(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 8000, y: 0 } },
    ],
    walls: [
      { id: "wall-1", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      createPlacedObject({
        id: "chair-1",
        presetId: null,
        name: "Стул 1",
        category: "chair",
        position: { x: 1000, y: 1000 },
        width: 500,
        depth: 500,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
      createPlacedObject({
        id: "chair-2",
        presetId: null,
        name: "Стул 2",
        category: "chair",
        position: { x: 3000, y: 1200 },
        width: 500,
        depth: 500,
        rotationDeg: 30,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
      createPlacedObject({
        id: "table-1",
        presetId: null,
        name: "Стол",
        category: "table",
        position: { x: 5000, y: 2200 },
        width: 1200,
        depth: 700,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
    ],
  };
}

function selection(...ids: string[]): EditorSelection {
  const [first, ...rest] = ids;
  if (!first) return { refs: [], primary: null };
  return addToSelection(
    replaceSelection({ kind: "placed-object", id: first }),
    rest.map((id) => ({ kind: "placed-object" as const, id })),
  );
}

function deterministicIds() {
  let placedObject = 0;
  return (kind: EditorEntityIdKind) => {
    if (kind === "placed-object") return `pasted-${++placedObject}`;
    return `${kind}-${crypto.randomUUID()}`;
  };
}

function storeWith(selectionValue: EditorSelection) {
  const store = createEditorStore({ idFactory: deterministicIds() });
  store.setState({
    history: createHistoryState(documentWithFurniture()),
    selection: selectionValue,
  });
  return store;
}

describe("M8.1 semantic clipboard store commands", () => {
  it("copies a furniture multi-selection without mutating document/history", () => {
    const store = storeWith(selection("chair-1", "chair-2"));
    const before = structuredClone(store.getState().history.document);

    store.getState().copySelection();

    const state = store.getState();
    expect(state.history.document).toEqual(before);
    expect(state.history.past).toHaveLength(0);
    expect(state.clipboard.payload?.objects.map((object) => object.id)).toEqual(["chair-1", "chair-2"]);
    expect(state.clipboard.lastPasteAnchor).toBeNull();
    expect(state.clipboard.repeatedPasteCount).toBe(0);
  });

  it("cuts the whole furniture selection as one batch delete and Undo restores it", () => {
    const store = storeWith(selection("chair-1", "chair-2"));
    const before = structuredClone(store.getState().history.document);

    store.getState().cutSelection();

    let state = store.getState();
    expect(state.history.document.placedObjects.map((object) => object.id)).toEqual(["table-1"]);
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("object/batch-delete");
    expect(state.selection).toEqual({ refs: [], primary: null });
    expect(state.clipboard.payload?.objects.map((object) => object.id)).toEqual(["chair-1", "chair-2"]);

    store.getState().undo();
    state = store.getState();
    expect(state.history.document).toEqual(before);
    expect(state.clipboard.payload?.objects.map((object) => object.id)).toEqual(["chair-1", "chair-2"]);
  });

  it("pastes with fresh IDs as one batch add, selects the result and Undo removes it", () => {
    const store = storeWith(selection("chair-1", "chair-2"));
    store.getState().copySelection();

    store.getState().pasteClipboard({ x: 6000, y: 5000 });

    let state = store.getState();
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("object/batch-add");
    expect(state.history.document.placedObjects.map((object) => object.id)).toEqual([
      "chair-1", "chair-2", "table-1", "pasted-1", "pasted-2",
    ]);
    expect(state.selection).toEqual({
      refs: [
        { kind: "placed-object", id: "pasted-1" },
        { kind: "placed-object", id: "pasted-2" },
      ],
      primary: { kind: "placed-object", id: "pasted-2" },
    });

    store.getState().undo();
    state = store.getState();
    expect(state.history.document.placedObjects.map((object) => object.id)).toEqual([
      "chair-1", "chair-2", "table-1",
    ]);
    expect(state.selection).toEqual({ refs: [], primary: null });
    expect(state.clipboard.payload).not.toBeNull();
  });

  it("sequences repeated paste by +200 mm and resets at a different anchor", () => {
    const store = storeWith(selection("chair-1", "chair-2"));
    store.getState().copySelection();
    const anchor = { x: 6000, y: 5000 };

    store.getState().pasteClipboard(anchor);
    const first = store.getState().history.document.placedObjects.slice(-2).map((object) => object.position);
    store.getState().pasteClipboard(anchor);
    const second = store.getState().history.document.placedObjects.slice(-2).map((object) => object.position);

    expect(second).toEqual(first.map((point) => ({ x: point.x + 200, y: point.y + 200 })));
    expect(store.getState().clipboard.lastPasteAnchor).toEqual(anchor);
    expect(store.getState().clipboard.repeatedPasteCount).toBe(2);

    const newAnchor = { x: 9000, y: 7000 };
    store.getState().pasteClipboard(newAnchor);
    const third = store.getState().history.document.placedObjects.slice(-2);
    const minX = Math.min(...third.map((object) => object.position.x - object.width / 2));
    const maxX = Math.max(...third.map((object) => object.position.x + object.width / 2));
    expect((minX + maxX) / 2).toBeCloseTo(newAnchor.x, 8);
    expect(store.getState().clipboard.lastPasteAnchor).toEqual(newAnchor);
    expect(store.getState().clipboard.repeatedPasteCount).toBe(1);
  });

  it("duplicates the selection by +200/+200 without replacing the persistent clipboard", () => {
    const store = storeWith(selection("table-1"));
    store.getState().copySelection();
    const persistentClipboard = structuredClone(store.getState().clipboard);
    store.setState({ selection: selection("chair-1", "chair-2") });

    store.getState().duplicateSelection();

    const state = store.getState();
    expect(state.clipboard).toEqual(persistentClipboard);
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("object/batch-add");
    const duplicates = state.history.document.placedObjects.slice(-2);
    expect(duplicates.map((object) => object.id)).toEqual(["pasted-1", "pasted-2"]);
    expect(duplicates.map((object) => object.position)).toEqual([
      { x: 1200, y: 1200 },
      { x: 3200, y: 1400 },
    ]);
  });

  it("fails closed for mixed structural selection without altering clipboard or document", () => {
    const store = storeWith(selection("chair-1"));
    store.getState().copySelection();
    const clipboardBefore = structuredClone(store.getState().clipboard);
    const documentBefore = structuredClone(store.getState().history.document);
    const mixed = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "placed-object", id: "chair-2" }],
    );
    store.setState({ selection: mixed });

    store.getState().copySelection();
    store.getState().cutSelection();
    store.getState().duplicateSelection();

    const state = store.getState();
    expect(state.history.document).toEqual(documentBefore);
    expect(state.history.past).toHaveLength(0);
    expect(state.selection).toEqual(mixed);
    expect(state.clipboard).toEqual(clipboardBefore);
  });

  it("treats paste with an empty clipboard as a no-op", () => {
    const store = storeWith(selection("chair-1"));
    const before = structuredClone(store.getState().history.document);

    store.getState().pasteClipboard({ x: 5000, y: 5000 });

    expect(store.getState().history.document).toEqual(before);
    expect(store.getState().history.past).toHaveLength(0);
  });
});
