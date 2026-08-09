import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { describe, expect, it } from "vitest";
import { createEditorStore, type EditorEntityIdKind } from "./use-editor-store";

function isolatedWall(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
    ],
    walls: [
      { id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
    ],
  };
}

function tJunction(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "j", position: { x: 3000, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
      { id: "p", position: { x: 3000, y: 2500 } },
    ],
    walls: [
      { id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 200 },
      { id: "branch", startVertexId: "j", endVertexId: "p", junctionVertexIds: [], thickness: 120 },
    ],
  };
}

function closedRoom(): VlezetDocument {
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
  };
}

function sequentialIds() {
  const counters: Record<EditorEntityIdKind, number> = {
    wall: 0,
    vertex: 0,
    "room-annotation": 0,
    opening: 0,
    "placed-object": 0,
  };
  return (kind: EditorEntityIdKind) => `${kind}-session-${++counters[kind]}`;
}

function setup(document: VlezetDocument) {
  const editor = createEditorStore({ idFactory: sequentialIds() });
  editor.setState({ history: createHistoryState(document) });
  return editor;
}

function vertexPosition(document: VlezetDocument, id: string) {
  return document.vertices.find((vertex) => vertex.id === id)?.position;
}

function selectAllWalls(editor: ReturnType<typeof createEditorStore>) {
  const [first, ...rest] = editor.getState().history.document.walls;
  if (!first) throw new Error("expected walls");
  editor.getState().replaceSelection({ kind: "wall", id: first.id });
  editor.getState().addSelection(rest.map((wall) => ({ kind: "wall" as const, id: wall.id })));
}

describe("M8.2 structural runtime in the unified editor store", () => {
  it("previews a vertex move without history and commits exactly one semantic command", () => {
    const editor = setup(isolatedWall());
    const baseline = structuredClone(editor.getState().history.document);

    editor.getState().beginStructuralVertexGesture("b");
    editor.getState().previewStructuralVertexGesture({ x: 4500, y: 500 });

    expect(editor.getState().history.past).toHaveLength(0);
    expect(vertexPosition(editor.getState().structuralGesture!.previewDocument, "b")).toEqual({ x: 4500, y: 500 });

    editor.getState().commitStructuralGesture();
    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("vertex/move-structural");
    expect(vertexPosition(editor.getState().history.document, "b")).toEqual({ x: 4500, y: 500 });
    expect(editor.getState().structuralGesture).toBeNull();

    editor.getState().undo();
    expect(editor.getState().history.document).toEqual(baseline);
    editor.getState().redo();
    expect(vertexPosition(editor.getState().history.document, "b")).toEqual({ x: 4500, y: 500 });
    editor.getState().undo();
    expect(editor.getState().history.document).toEqual(baseline);
  });

  it("keeps an invalid structural preview out of history until cancelled or corrected", () => {
    const editor = setup(tJunction());
    const baseline = structuredClone(editor.getState().history.document);

    editor.getState().beginStructuralVertexGesture("j");
    editor.getState().previewStructuralVertexGesture({ x: 3500, y: 500 });

    expect(editor.getState().structuralGesture).toMatchObject({ valid: false });
    expect(editor.getState().structuralGesture?.reason).toMatch(/соедин|стен/i);
    expect(editor.getState().history.past).toHaveLength(0);

    editor.getState().commitStructuralGesture();
    expect(editor.getState().history.document).toEqual(baseline);
    expect(editor.getState().history.past).toHaveLength(0);
    expect(editor.getState().structuralGesture).not.toBeNull();

    editor.getState().cancelStructuralGesture();
    expect(editor.getState().structuralGesture).toBeNull();
    expect(editor.getState().history.document).toEqual(baseline);
  });

  it("commits rigid wall translation as one wall/translate history entry", () => {
    const editor = setup(isolatedWall());

    editor.getState().beginStructuralWallGesture("wall");
    editor.getState().previewStructuralWallGesture({ x: 250, y: 500 });
    expect(editor.getState().history.past).toHaveLength(0);

    editor.getState().commitStructuralGesture();

    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("wall/translate");
    expect(vertexPosition(editor.getState().history.document, "a")).toEqual({ x: 250, y: 500 });
    expect(vertexPosition(editor.getState().history.document, "b")).toEqual({ x: 4250, y: 500 });
  });

  it("applies selected-wall thickness atomically as one history entry", () => {
    const editor = setup(closedRoom());
    editor.getState().replaceSelection({ kind: "wall", id: "top" });
    editor.getState().addSelection([{ kind: "wall", id: "right" }]);

    editor.getState().setSelectedWallsThickness(300);

    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("wall/batch-set-thickness");
    expect(editor.getState().history.document.walls.slice(0, 2).map((wall) => wall.thickness)).toEqual([300, 300]);
    editor.getState().undo();
    expect(editor.getState().history.document.walls.slice(0, 2).map((wall) => wall.thickness)).toEqual([200, 180]);
  });

  it("uses the existing discriminated editor clipboard for structural copy and cut", () => {
    const editor = setup(closedRoom());
    selectAllWalls(editor);

    editor.getState().copySelection();
    expect(editor.getState().clipboard.payload?.kind).toBe("structural-fragment");
    expect(editor.getState().history.past).toHaveLength(0);

    editor.getState().cutSelection();
    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("structure/cut");
    expect(editor.getState().history.document.walls).toEqual([]);
    expect(editor.getState().selection.refs).toEqual([]);
    expect(editor.getState().clipboard.payload?.kind).toBe("structural-fragment");

    editor.getState().undo();
    expect(editor.getState().history.document.walls).toHaveLength(4);
  });

  it("pastes structural clipboard through the existing paste command as one fresh-id history operation", () => {
    const editor = setup(closedRoom());
    selectAllWalls(editor);
    editor.getState().copySelection();

    editor.getState().pasteClipboard({ x: 6000, y: 500 });

    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("structure/paste");
    expect(editor.getState().history.document.walls).toHaveLength(8);
    expect(editor.getState().selection.refs).toEqual([
      { kind: "wall", id: "wall-session-1" },
      { kind: "wall", id: "wall-session-2" },
      { kind: "wall", id: "wall-session-3" },
      { kind: "wall", id: "wall-session-4" },
    ]);
    expect(editor.getState().clipboard.payload?.kind).toBe("structural-fragment");

    editor.getState().undo();
    expect(editor.getState().history.document.walls).toHaveLength(4);
  });
});
