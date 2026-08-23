import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection, type EditorSelection } from "./editor-selection";
import { createEditorStore } from "./use-editor-store";

function furnitureDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
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
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
    ],
  };
}

function furnitureSelection(...ids: string[]): EditorSelection {
  const [first, ...rest] = ids;
  if (!first) return { refs: [], primary: null };
  return addToSelection(
    replaceSelection({ kind: "placed-object", id: first }),
    rest.map((id) => ({ kind: "placed-object" as const, id })),
  );
}

describe("M8.4-UX arrow-key nudge store action", () => {
  it("moves a single selected object by the exact delta as one Undo/Redo step", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document), selection: furnitureSelection("chair-1") });

    store.getState().nudgeSelection({ x: 10, y: 0 });

    let state = store.getState();
    expect(state.history.document.placedObjects.find((o) => o.id === "chair-1")?.position).toEqual({ x: 1010, y: 1000 });
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("object/batch-move");
    expect(state.selection).toEqual(furnitureSelection("chair-1"));

    store.getState().undo();
    state = store.getState();
    expect(state.history.document).toEqual(document);
  });

  it("applies the identical rigid delta to every selected object", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document), selection: furnitureSelection("chair-1", "chair-2") });

    store.getState().nudgeSelection({ x: 0, y: -100 });

    const objects = store.getState().history.document.placedObjects;
    expect(objects.find((o) => o.id === "chair-1")?.position).toEqual({ x: 1000, y: 900 });
    expect(objects.find((o) => o.id === "chair-2")?.position).toEqual({ x: 3000, y: 1100 });
  });

  it("does nothing when the selection is not placed-objects", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document), selection: replaceSelection({ kind: "wall", id: "wall-1" }) });

    store.getState().nudgeSelection({ x: 10, y: 0 });

    const state = store.getState();
    expect(state.history.document).toEqual(document);
    expect(state.history.past).toHaveLength(0);
  });

  it("does nothing on an empty selection", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document), selection: { refs: [], primary: null } });

    store.getState().nudgeSelection({ x: 10, y: 0 });

    const state = store.getState();
    expect(state.history.document).toEqual(document);
    expect(state.history.past).toHaveLength(0);
  });
});
