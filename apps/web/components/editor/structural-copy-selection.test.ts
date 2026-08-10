import { type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { replaceSelection } from "./editor-selection";
import { deriveSelectionCapabilities } from "./editor-selection-capabilities";
import { createEditorStore, type EditorEntityIdKind } from "./use-editor-store";

function roomDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [
      { id: "door", wallId: "top", kind: "door", offset: 1000, width: 900 },
    ],
    roomAnnotations: [
      { id: "room-name", name: "Спальня", anchor: { x: 2000, y: 1500 } },
    ],
    placedObjects: [],
  };
}

function ids() {
  const counters: Record<EditorEntityIdKind, number> = {
    wall: 0,
    vertex: 0,
    "room-annotation": 0,
    opening: 0,
    "placed-object": 0,
  };
  return (kind: EditorEntityIdKind) => `${kind}-copy-${++counters[kind]}`;
}

function roomStore() {
  const document = roomDocument();
  const room = deriveRooms(document).rooms[0]!;
  const store = createEditorStore({ idFactory: ids() });
  store.setState({ history: createHistoryState(document) });
  store.getState().selectRoom(room.id);
  return { document, room, store };
}

describe("wall and room clipboard UX", () => {
  it("enables Copy and Duplicate for one connected wall while keeping Cut fail-closed", () => {
    const document = roomDocument();
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: replaceSelection({ kind: "wall", id: "top" }),
      clipboardKind: null,
    });

    expect(capabilities.copy.enabled).toBe(true);
    expect(capabilities.duplicate.enabled).toBe(true);
    expect(capabilities.cut.enabled).toBe(false);
  });

  it("enables Copy and Duplicate for one derived room without enabling destructive room Cut", () => {
    const document = roomDocument();
    const room = deriveRooms(document).rooms[0]!;
    const capabilities = deriveSelectionCapabilities({
      document,
      selection: replaceSelection({ kind: "room", id: room.id }),
      clipboardKind: null,
    });

    expect(capabilities.copy.enabled).toBe(true);
    expect(capabilities.duplicate.enabled).toBe(true);
    expect(capabilities.cut.enabled).toBe(false);
  });

  it("copies and pastes a selected room atomically with its shell, opening and explicit name", () => {
    const { room, store } = roomStore();

    store.getState().copySelection();
    expect(store.getState().clipboard.payload?.kind).toBe("structural-fragment");

    const beforeHistory = store.getState().history.past.length;
    store.getState().pasteClipboard({ x: 6000, y: 0 });

    const state = store.getState();
    expect(state.history.past).toHaveLength(beforeHistory + 1);
    expect(state.history.document.walls).toHaveLength(8);
    expect(state.history.document.openings).toHaveLength(2);
    expect(state.history.document.roomAnnotations).toHaveLength(2);
    expect(deriveRooms(state.history.document).rooms.some((candidate) => candidate.name === "Спальня" && candidate.id !== room.id)).toBe(true);

    store.getState().undo();
    expect(store.getState().history.document.walls).toHaveLength(4);
    store.getState().redo();
    expect(store.getState().history.document.walls).toHaveLength(8);
  });

  it("falls back to a deterministic non-overlapping position when the ordinary paste anchor overlaps the source room", () => {
    const { store } = roomStore();
    store.getState().copySelection();

    store.getState().pasteClipboard({ x: 200, y: 200 });

    const document = store.getState().history.document;
    expect(document.walls).toHaveLength(8);
    expect(document.openings).toHaveLength(2);
    expect(document.roomAnnotations).toHaveLength(2);
    expect(deriveRooms(document).rooms).toHaveLength(2);
  });
});