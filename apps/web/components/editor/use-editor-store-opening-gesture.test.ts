import type { Opening, VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { describe, expect, it } from "vitest";
import { createEditorStore } from "./use-editor-store";

function openingDocument(extraOpenings: readonly Opening[] = []): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
      { id: "c", position: { x: 6000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "nearby", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
    ],
    openings: [
      {
        id: "door-a",
        wallId: "host",
        kind: "door",
        offset: 500,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
      ...extraOpenings,
    ],
    roomAnnotations: [],
    placedObjects: [],
  };
}

function preparedStore(document = openingDocument()) {
  const store = createEditorStore();
  store.setState({ history: createHistoryState(document) });
  return store;
}

function opening(document: VlezetDocument, id = "door-a") {
  return document.openings.find((candidate) => candidate.id === id)!;
}

describe("M8.2 hosted opening structural gesture", () => {
  it("begins on one opening, selects it and captures immutable structural state", () => {
    const document = openingDocument();
    const store = preparedStore(document);

    store.getState().beginStructuralOpeningGesture("door-a");

    const state = store.getState();
    expect(state.structuralGesture?.kind).toBe("translate-opening");
    expect(state.structuralGesture?.entityId).toBe("door-a");
    expect(state.structuralGesture?.before).toBe(document);
    expect(state.structuralGesture?.previewDocument).toBe(document);
    expect(state.structuralGesture?.valid).toBe(true);
    expect(state.structuralGesture?.changed).toBe(false);
    expect(state.selection.refs).toEqual([{ kind: "opening", id: "door-a" }]);
    expect(state.history.past).toHaveLength(0);
  });

  it("previews along the current host wall and never re-hosts to a nearby wall", () => {
    const document = openingDocument();
    const store = preparedStore(document);
    store.getState().beginStructuralOpeningGesture("door-a");

    store.getState().previewStructuralOpeningGesture({ x: 3400, y: 600 });
    let gesture = store.getState().structuralGesture;
    expect(gesture?.kind).toBe("translate-opening");
    expect(gesture?.valid).toBe(true);
    expect(gesture?.changed).toBe(true);
    expect(opening(gesture!.previewDocument).offset).toBeCloseTo(2950, 6);
    expect(opening(gesture!.previewDocument).wallId).toBe("host");

    store.getState().previewStructuralOpeningGesture({ x: 6100, y: 2600 });
    gesture = store.getState().structuralGesture;
    expect(gesture?.kind).toBe("translate-opening");
    expect(opening(gesture!.previewDocument).wallId).toBe("host");
    expect(opening(gesture!.previewDocument).offset).toBe(5100);
  });

  it("keeps an invalid overlap candidate and reason but commits nothing", () => {
    const document = openingDocument([
      { id: "window-b", wallId: "host", kind: "window", offset: 2500, width: 1000 },
    ]);
    const store = preparedStore(document);
    store.getState().beginStructuralOpeningGesture("door-a");

    store.getState().previewStructuralOpeningGesture({ x: 3000, y: 0 });
    let state = store.getState();
    expect(state.structuralGesture?.kind).toBe("translate-opening");
    expect(state.structuralGesture?.valid).toBe(false);
    expect(state.structuralGesture?.reason).toMatch(/пересек/i);
    expect(opening(state.structuralGesture!.previewDocument).offset).toBeCloseTo(2550, 6);
    expect(state.history.document).toEqual(document);
    expect(state.history.past).toHaveLength(0);

    store.getState().commitStructuralGesture();
    state = store.getState();
    expect(state.history.document).toEqual(document);
    expect(state.history.past).toHaveLength(0);
  });

  it("commits one semantic opening move and Undo/Redo restores exact offsets", () => {
    const document = openingDocument();
    const store = preparedStore(document);
    store.getState().beginStructuralOpeningGesture("door-a");
    store.getState().previewStructuralOpeningGesture({ x: 3400, y: 600 });

    store.getState().commitStructuralGesture();
    const state = store.getState();
    const after = structuredClone(state.history.document);
    expect(state.structuralGesture).toBeNull();
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("opening/move-host");
    expect(opening(after).offset).toBeCloseTo(2950, 6);
    expect(opening(after).wallId).toBe("host");

    store.getState().undo();
    expect(store.getState().history.document).toEqual(document);
    store.getState().redo();
    expect(store.getState().history.document).toEqual(after);
  });

  it("creates no history for a no-op or explicit cancel", () => {
    const document = openingDocument();
    const store = preparedStore(document);
    const currentCenter = 500 + 900 / 2;

    store.getState().beginStructuralOpeningGesture("door-a");
    store.getState().previewStructuralOpeningGesture({ x: currentCenter, y: 900 });
    store.getState().commitStructuralGesture();
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.document).toEqual(document);

    store.getState().beginStructuralOpeningGesture("door-a");
    store.getState().previewStructuralOpeningGesture({ x: 3400, y: 0 });
    store.getState().cancelStructuralGesture();
    expect(store.getState().history.document).toEqual(document);
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("rejects stale concurrent document mutation without a partial commit", () => {
    const document = openingDocument();
    const store = preparedStore(document);
    store.getState().beginStructuralOpeningGesture("door-a");
    store.getState().previewStructuralOpeningGesture({ x: 3400, y: 0 });

    const concurrent = { ...document, roomAnnotations: [...document.roomAnnotations] };
    store.setState({ history: createHistoryState(concurrent) });
    store.getState().commitStructuralGesture();

    const state = store.getState();
    expect(state.structuralGesture?.kind).toBe("translate-opening");
    expect(state.structuralGesture?.valid).toBe(false);
    expect(state.structuralGesture?.reason).toMatch(/изменился/i);
    expect(state.history.document).toBe(concurrent);
    expect(state.history.past).toHaveLength(0);
  });
});
