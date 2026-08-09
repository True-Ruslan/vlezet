import { describe, expect, it } from "vitest";
import {
  createEditorStore,
  selectedOpeningId,
  selectedRoomId,
  selectedWallId,
  type EditorEntityIdKind,
} from "./use-editor-store";

const noSnap = (x: number, y: number) => ({ point: { x, y }, kind: "none" as const, guides: [] });

function ids() {
  const counts = new Map<EditorEntityIdKind, number>();
  return (kind: EditorEntityIdKind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}-${next}`;
  };
}

function createHost(store: ReturnType<typeof createEditorStore>) {
  store.getState().setTool("wall");
  store.getState().beginWall({ x: 0, y: 0 });
  store.getState().updateDraftWall(noSnap(6000, 0));
  store.getState().commitDraftWall();
  store.getState().cancelDraft();
}

describe("opening editor store", () => {
  it("adds a default door centred on the projected pointer offset", () => {
    const store = createEditorStore({ idFactory: ids() });
    createHost(store);
    store.getState().setTool("door");
    store.getState().addOpeningAt("wall-1", 2000);

    expect(store.getState().history.document.openings[0]).toEqual({
      id: "opening-1",
      wallId: "wall-1",
      kind: "door",
      offset: 1550,
      width: 900,
      doorSwing: { hinge: "start", side: "left" },
    });
    expect(selectedOpeningId(store.getState().selection)).toBe("opening-1");
  });

  it("adds a default window and supports update/delete with undo", () => {
    const store = createEditorStore({ idFactory: ids() });
    createHost(store);
    store.getState().setTool("window");
    store.getState().addOpeningAt("wall-1", 3000);
    expect(store.getState().history.document.openings[0]?.width).toBe(1200);

    store.getState().updateSelectedOpening({ offset: 3500, width: 1000 });
    expect(store.getState().history.document.openings[0]?.offset).toBe(3500);
    store.getState().deleteSelectedOpening();
    expect(store.getState().history.document.openings).toEqual([]);
    store.getState().undo();
    expect(store.getState().history.document.openings[0]?.offset).toBe(3500);
  });

  it("keeps one opening selection mutually exclusive with rooms and walls", () => {
    const store = createEditorStore({ idFactory: ids() });
    createHost(store);
    store.getState().setTool("door");
    store.getState().addOpeningAt("wall-1", 2000);
    let state = store.getState();
    expect(selectedWallId(state.selection)).toBeNull();
    expect(selectedRoomId(state.selection)).toBeNull();
    expect(selectedOpeningId(state.selection)).toBe("opening-1");

    store.getState().selectWall("wall-1");
    state = store.getState();
    expect(selectedOpeningId(state.selection)).toBeNull();
    expect(selectedWallId(state.selection)).toBe("wall-1");
  });
});
