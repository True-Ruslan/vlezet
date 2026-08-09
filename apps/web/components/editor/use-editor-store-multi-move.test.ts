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
        rotationDeg: 15,
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
        rotationDeg: 45,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
      createPlacedObject({
        id: "table-1",
        presetId: null,
        name: "Стол",
        category: "table",
        position: { x: 4500, y: 2200 },
        width: 1200,
        depth: 700,
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

describe("M8.1 rigid multi-furniture move gesture", () => {
  it("preserves a compatible furniture selection and makes the dragged member the snap anchor", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({
      history: createHistoryState(document),
      selection: furnitureSelection("chair-1", "chair-2"),
    });

    store.getState().beginObjectGesture("chair-1", "move");

    expect(store.getState().selection).toEqual({
      refs: [
        { kind: "placed-object", id: "chair-1" },
        { kind: "placed-object", id: "chair-2" },
      ],
      primary: { kind: "placed-object", id: "chair-1" },
    });
    expect(store.getState().objectGesture).toMatchObject({
      kind: "move",
      anchorObjectId: "chair-1",
      objectIds: ["chair-1", "chair-2"],
    });
  });

  it("applies one identical anchor delta to every selected furniture preview", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({
      history: createHistoryState(document),
      selection: furnitureSelection("chair-1", "chair-2"),
    });
    store.getState().beginObjectGesture("chair-1", "move");

    store.getState().previewObjectGesture({ position: { x: 1500, y: 1400 } });

    const gesture = store.getState().objectGesture;
    expect(gesture?.kind).toBe("move");
    if (!gesture || gesture.kind !== "move") throw new Error("Expected move gesture");
    expect(gesture.preview.map((object) => ({ id: object.id, position: object.position, rotationDeg: object.rotationDeg }))).toEqual([
      { id: "chair-1", position: { x: 1500, y: 1400 }, rotationDeg: 15 },
      { id: "chair-2", position: { x: 3500, y: 1600 }, rotationDeg: 45 },
    ]);
    expect(store.getState().history.document).toEqual(document);
  });

  it("commits one semantic batch move and one Undo/Redo restores the whole group", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({
      history: createHistoryState(document),
      selection: furnitureSelection("chair-1", "chair-2"),
    });
    store.getState().beginObjectGesture("chair-1", "move");
    store.getState().previewObjectGesture({ position: { x: 1500, y: 1400 } });
    store.getState().commitObjectGesture();

    let state = store.getState();
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("object/batch-move");
    expect(state.history.document.placedObjects.map((object) => object.position)).toEqual([
      { x: 1500, y: 1400 },
      { x: 3500, y: 1600 },
      { x: 4500, y: 2200 },
    ]);

    store.getState().undo();
    expect(store.getState().history.document).toEqual(document);
    store.getState().redo();
    state = store.getState();
    expect(state.history.document.placedObjects[0]?.position).toEqual({ x: 1500, y: 1400 });
    expect(state.history.document.placedObjects[1]?.position).toEqual({ x: 3500, y: 1600 });
  });

  it("creates no history entry for zero delta and cancel leaves exact originals", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({
      history: createHistoryState(document),
      selection: furnitureSelection("chair-1", "chair-2"),
    });

    store.getState().beginObjectGesture("chair-1", "move");
    store.getState().commitObjectGesture();
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.document).toEqual(document);

    store.getState().beginObjectGesture("chair-1", "move");
    store.getState().previewObjectGesture({ position: { x: 1900, y: 1700 } });
    store.getState().cancelObjectGesture();
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.document).toEqual(document);
    expect(store.getState().objectGesture).toBeNull();
  });

  it("fails closed when the dragged selected object belongs to a mixed structural selection", () => {
    const document = furnitureDocument();
    const mixed = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "placed-object", id: "chair-1" }],
    );
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document), selection: mixed });

    store.getState().beginObjectGesture("chair-1", "move");

    expect(store.getState().objectGesture).toBeNull();
    expect(store.getState().selection).toEqual(mixed);
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("replaces selection when dragging an unselected object and moves only that object", () => {
    const document = furnitureDocument();
    const store = createEditorStore();
    store.setState({
      history: createHistoryState(document),
      selection: furnitureSelection("chair-1", "chair-2"),
    });

    store.getState().beginObjectGesture("table-1", "move");
    expect(store.getState().selection).toEqual({
      refs: [{ kind: "placed-object", id: "table-1" }],
      primary: { kind: "placed-object", id: "table-1" },
    });

    store.getState().previewObjectGesture({ position: { x: 5000, y: 2500 } });
    store.getState().commitObjectGesture();
    expect(store.getState().history.document.placedObjects.map((object) => object.position)).toEqual([
      { x: 1000, y: 1000 },
      { x: 3000, y: 1200 },
      { x: 5000, y: 2500 },
    ]);
  });
});
