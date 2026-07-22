import { describe, expect, it } from "vitest";
import { createEditorStore } from "../editor/use-editor-store";
import { createSpatialViewModeStore } from "./view-mode-store";

describe("spatial view mode store", () => {
  it("starts in 2D and switches explicitly without semantic payload", () => {
    const store = createSpatialViewModeStore();

    expect(store.getState().mode).toBe("2d");
    store.getState().setMode("3d");
    expect(store.getState().mode).toBe("3d");
    store.getState().setMode("2d");
    expect(store.getState().mode).toBe("2d");
  });

  it("does not mutate the editor document or semantic history when switching views", () => {
    const editor = createEditorStore();
    const view = createSpatialViewModeStore();
    const historyBefore = editor.getState().history;
    const documentBefore = historyBefore.document;

    view.getState().setMode("3d");
    view.getState().setMode("2d");

    expect(editor.getState().history).toBe(historyBefore);
    expect(editor.getState().history.document).toBe(documentBefore);
    expect(editor.getState().history.past).toEqual([]);
    expect(editor.getState().history.future).toEqual([]);
  });

  it("can be initialized independently for isolated tests", () => {
    expect(createSpatialViewModeStore("3d").getState().mode).toBe("3d");
  });
});
