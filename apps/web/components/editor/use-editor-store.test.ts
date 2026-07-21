import { describe, expect, it } from "vitest";
import { createEditorStore } from "./use-editor-store";

const noSnap = (x: number, y: number) => ({ point: { x, y }, kind: "none" as const, guides: [] });

describe("editor store", () => {
  it("commits a draft wall as exactly one history entry", () => {
    const store = createEditorStore({ idFactory: () => "wall-1" });
    store.getState().setTool("wall");
    store.getState().beginWall({ x: 0, y: 0 });
    store.getState().updateDraftWall(noSnap(3000, 0));
    store.getState().commitDraftWall();
    const state = store.getState();
    expect(state.history.document.walls).toHaveLength(1);
    expect(state.history.document.walls[0]?.id).toBe("wall-1");
    expect(state.history.past).toHaveLength(1);
  });

  it("chains the next wall draft from the committed endpoint while the wall tool remains active", () => {
    const store = createEditorStore({ idFactory: () => "wall-1" });
    store.getState().setTool("wall");
    store.getState().beginWall({ x: 0, y: 0 });
    store.getState().updateDraftWall(noSnap(2500, 700));
    store.getState().commitDraftWall();
    expect(store.getState().draftWall).toEqual({
      start: { x: 2500, y: 700 }, end: { x: 2500, y: 700 }, snap: noSnap(2500, 700),
    });
  });

  it("cancels a draft without creating history", () => {
    const store = createEditorStore({ idFactory: () => "wall-1" });
    store.getState().beginWall({ x: 0, y: 0 });
    store.getState().updateDraftWall(noSnap(1000, 0));
    store.getState().cancelDraft();
    expect(store.getState().draftWall).toBeNull();
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("commits exact wall length as one replace command", () => {
    const store = createEditorStore({ idFactory: () => "wall-1" });
    store.getState().setTool("wall");
    store.getState().beginWall({ x: 0, y: 0 });
    store.getState().updateDraftWall(noSnap(3000, 4000));
    store.getState().commitDraftWall();
    store.getState().selectWall("wall-1");
    store.getState().setSelectedWallLength(10000);
    const state = store.getState();
    expect(state.history.past).toHaveLength(2);
    expect(state.history.document.walls[0]?.end.x).toBeCloseTo(6000, 10);
    expect(state.history.document.walls[0]?.end.y).toBeCloseTo(8000, 10);
  });

  it("delegates undo and redo while keeping selection safe", () => {
    const store = createEditorStore({ idFactory: () => "wall-1" });
    store.getState().setTool("wall");
    store.getState().beginWall({ x: 0, y: 0 });
    store.getState().updateDraftWall(noSnap(2000, 0));
    store.getState().commitDraftWall();
    store.getState().selectWall("wall-1");
    store.getState().undo();
    expect(store.getState().history.document.walls).toHaveLength(0);
    expect(store.getState().selectedWallId).toBeNull();
    store.getState().redo();
    expect(store.getState().history.document.walls).toHaveLength(1);
  });
});
