import { describe, expect, it } from "vitest";
import { createEditorStore } from "./use-editor-store";

describe("M8.2 exact draft wall updates", () => {
  it("updates only the active draft endpoint without creating history and clears stale pointer snap target", () => {
    const store = createEditorStore();
    store.getState().setTool("wall");
    store.getState().beginWall({ x: 1000, y: 1500 });
    store.getState().updateDraftWall(
      { point: { x: 3000, y: 1500 }, kind: "endpoint", guides: [] },
      { kind: "vertex", vertexId: "pointer-target", point: { x: 3000, y: 1500 } },
    );

    store.getState().updateDraftWallPoint({ x: 1000, y: 5500 });

    expect(store.getState().draftWall).toMatchObject({
      start: { x: 1000, y: 1500 },
      end: { x: 1000, y: 5500 },
      snap: { point: { x: 1000, y: 5500 }, kind: "none", guides: [] },
      startTarget: null,
      endTarget: null,
    });
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.future).toHaveLength(0);
  });

  it("is a no-op when no wall draft exists", () => {
    const store = createEditorStore();
    const before = store.getState().history;

    store.getState().updateDraftWallPoint({ x: 1000, y: 2000 });

    expect(store.getState().draftWall).toBeNull();
    expect(store.getState().history).toBe(before);
  });
});
