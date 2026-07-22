import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import { addTopologicalWall } from "@vlezet/editor-core";
import { createEditorStore } from "../editor/use-editor-store";
import { commitRecognitionDocument } from "./recognition-editor-apply";

describe("recognition editor batch commit", () => {
  it("commits the entire recognized document as one undoable history operation", () => {
    let id = 0;
    const store = createEditorStore({ idFactory: (kind) => `${kind}-${++id}` });
    const before = createEmptyDocument();
    const after = addTopologicalWall(before, {
      wallId: "recognized-wall",
      start: { kind: "new-vertex", vertexId: "recognized-start", position: { x: 0, y: 0 } },
      end: { kind: "new-vertex", vertexId: "recognized-end", position: { x: 3000, y: 0 } },
      thickness: 150,
    }).document;

    commitRecognitionDocument(store, after);
    expect(store.getState().history.document.walls).toHaveLength(1);
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.past[0]?.forward.label).toBe("recognition/apply");

    store.getState().undo();
    expect(store.getState().history.document).toEqual(before);
    store.getState().redo();
    expect(store.getState().history.document).toEqual(after);
  });
});
