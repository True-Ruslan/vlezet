import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { describe, expect, it } from "vitest";
import { createStructuralEditorSession } from "./structural-editor-session";
import { createEditorStore } from "./use-editor-store";

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

function setup(document: VlezetDocument) {
  const editor = createEditorStore();
  editor.setState({ history: createHistoryState(document) });
  const counters = { vertex: 0, wall: 0, opening: 0 };
  const session = createStructuralEditorSession(editor, {
    idFactory: (kind) => `${kind}-session-${++counters[kind]}`,
  });
  return { editor, session };
}

function vertexPosition(document: VlezetDocument, id: string) {
  return document.vertices.find((vertex) => vertex.id === id)?.position;
}

describe("M8.2 structural runtime session", () => {
  it("previews a vertex move without history and commits exactly one semantic command", () => {
    const { editor, session } = setup(isolatedWall());
    const baseline = structuredClone(editor.getState().history.document);

    session.getState().beginVertexGesture("b");
    session.getState().previewVertexGesture({ x: 4500, y: 500 });

    expect(editor.getState().history.past).toHaveLength(0);
    expect(vertexPosition(session.getState().gesture!.previewDocument, "b")).toEqual({ x: 4500, y: 500 });

    session.getState().commitGesture();
    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("vertex/move-structural");
    expect(vertexPosition(editor.getState().history.document, "b")).toEqual({ x: 4500, y: 500 });
    expect(session.getState().gesture).toBeNull();

    editor.getState().undo();
    expect(editor.getState().history.document).toEqual(baseline);
    editor.getState().redo();
    expect(vertexPosition(editor.getState().history.document, "b")).toEqual({ x: 4500, y: 500 });
    editor.getState().undo();
    expect(editor.getState().history.document).toEqual(baseline);
  });

  it("keeps an invalid structural preview out of history until the gesture is cancelled or corrected", () => {
    const { editor, session } = setup(tJunction());
    const baseline = structuredClone(editor.getState().history.document);

    session.getState().beginVertexGesture("j");
    session.getState().previewVertexGesture({ x: 3500, y: 500 });

    expect(session.getState().gesture).toMatchObject({ valid: false });
    expect(session.getState().gesture?.reason).toMatch(/соедин|стен/i);
    expect(editor.getState().history.past).toHaveLength(0);

    session.getState().commitGesture();
    expect(editor.getState().history.document).toEqual(baseline);
    expect(editor.getState().history.past).toHaveLength(0);
    expect(session.getState().gesture).not.toBeNull();

    session.getState().cancelGesture();
    expect(session.getState().gesture).toBeNull();
    expect(editor.getState().history.document).toEqual(baseline);
  });

  it("commits rigid wall translation as one wall/translate history entry", () => {
    const { editor, session } = setup(isolatedWall());

    session.getState().beginWallGesture("wall");
    session.getState().previewWallGesture({ x: 250, y: 500 });
    expect(editor.getState().history.past).toHaveLength(0);

    session.getState().commitGesture();

    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("wall/translate");
    expect(vertexPosition(editor.getState().history.document, "a")).toEqual({ x: 250, y: 500 });
    expect(vertexPosition(editor.getState().history.document, "b")).toEqual({ x: 4250, y: 500 });
  });

  it("applies selected-wall thickness atomically as one history entry", () => {
    const { editor, session } = setup(closedRoom());
    editor.getState().replaceSelection({ kind: "wall", id: "top" });
    editor.getState().addSelection([{ kind: "wall", id: "right" }]);

    session.getState().setSelectedWallsThickness(300);

    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("wall/batch-set-thickness");
    expect(editor.getState().history.document.walls.slice(0, 2).map((wall) => wall.thickness)).toEqual([300, 300]);
    editor.getState().undo();
    expect(editor.getState().history.document.walls.slice(0, 2).map((wall) => wall.thickness)).toEqual([200, 180]);
  });

  it("copies a closed wall selection without history and cuts it atomically", () => {
    const { editor, session } = setup(closedRoom());
    editor.getState().replaceSelection({ kind: "wall", id: "top" });
    editor.getState().addSelection([
      { kind: "wall", id: "right" },
      { kind: "wall", id: "bottom" },
      { kind: "wall", id: "left" },
    ]);

    session.getState().copySelection();
    expect(session.getState().clipboard?.kind).toBe("structural-fragment");
    expect(editor.getState().history.past).toHaveLength(0);

    session.getState().cutSelection();
    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("structure/cut");
    expect(editor.getState().history.document.walls).toEqual([]);
    expect(editor.getState().selection.refs).toEqual([]);

    editor.getState().undo();
    expect(editor.getState().history.document.walls).toHaveLength(4);
  });

  it("pastes the structural clipboard as one fresh-id history operation", () => {
    const { editor, session } = setup(closedRoom());
    editor.getState().replaceSelection({ kind: "wall", id: "top" });
    editor.getState().addSelection([
      { kind: "wall", id: "right" },
      { kind: "wall", id: "bottom" },
      { kind: "wall", id: "left" },
    ]);
    session.getState().copySelection();

    session.getState().pasteClipboard({ x: 6000, y: 500 });

    expect(editor.getState().history.past).toHaveLength(1);
    expect(editor.getState().history.past[0]?.forward.label).toBe("structure/paste");
    expect(editor.getState().history.document.walls).toHaveLength(8);
    expect(editor.getState().selection.refs).toEqual([
      { kind: "wall", id: "wall-session-1" },
      { kind: "wall", id: "wall-session-2" },
      { kind: "wall", id: "wall-session-3" },
      { kind: "wall", id: "wall-session-4" },
    ]);

    editor.getState().undo();
    expect(editor.getState().history.document.walls).toHaveLength(4);
  });
});
