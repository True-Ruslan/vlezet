import { describe, expect, it } from "vitest";
import { deriveRooms } from "@vlezet/geometry";
import { createEditorStore, type EditorEntityIdKind } from "./use-editor-store";

const noSnap = (x: number, y: number) => ({ point: { x, y }, kind: "none" as const, guides: [] });

function idFactory() {
  const counts = new Map<EditorEntityIdKind, number>();
  return (kind: EditorEntityIdKind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}-${next}`;
  };
}

function drawRectangle(store: ReturnType<typeof createEditorStore>) {
  store.getState().setTool("wall");
  store.getState().beginWall({ x: 0, y: 0 });
  store.getState().updateDraftWall(noSnap(4000, 0));
  store.getState().commitDraftWall();
  store.getState().updateDraftWall(noSnap(4000, 3000));
  store.getState().commitDraftWall();
  store.getState().updateDraftWall(noSnap(0, 3000));
  store.getState().commitDraftWall();
  store.getState().updateDraftWall(noSnap(0, 0), {
    kind: "vertex",
    vertexId: "vertex-1",
    point: { x: 0, y: 0 },
  });
  store.getState().commitDraftWall();
  store.getState().cancelDraft();
}

describe("room editor store", () => {
  it("selects a derived room and renames it as one undoable semantic action", () => {
    const store = createEditorStore({ idFactory: idFactory() });
    drawRectangle(store);
    const room = deriveRooms(store.getState().history.document).rooms[0]!;

    store.getState().selectRoom(room.id);
    expect(store.getState().selectedRoomId).toBe(room.id);
    expect(store.getState().selectedWallId).toBeNull();

    const beforeHistory = store.getState().history.past.length;
    store.getState().setSelectedRoomName("Спальня");

    expect(store.getState().history.past).toHaveLength(beforeHistory + 1);
    expect(store.getState().history.document.roomAnnotations).toHaveLength(1);
    expect(deriveRooms(store.getState().history.document).rooms[0]?.name).toBe("Спальня");

    store.getState().undo();
    expect(store.getState().history.document.roomAnnotations).toHaveLength(0);
    store.getState().redo();
    expect(deriveRooms(store.getState().history.document).rooms[0]?.name).toBe("Спальня");
  });

  it("clears room selection when selecting a wall", () => {
    const store = createEditorStore({ idFactory: idFactory() });
    drawRectangle(store);
    const room = deriveRooms(store.getState().history.document).rooms[0]!;
    store.getState().selectRoom(room.id);
    store.getState().selectWall("wall-1");
    expect(store.getState().selectedRoomId).toBeNull();
    expect(store.getState().selectedWallId).toBe("wall-1");
  });
});
