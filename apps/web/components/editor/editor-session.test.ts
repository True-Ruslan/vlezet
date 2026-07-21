import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import { editorStore } from "./use-editor-store";
import { loadEditorDocument } from "./editor-session";

const noSnap = { point: { x: 1000, y: 1000 }, kind: "none" as const, guides: [] };

describe("project editor session", () => {
  it("loads a project into fresh history and clears transient state", () => {
    editorStore.getState().setTool("wall");
    editorStore.getState().beginWall({ x: 0, y: 0 });
    editorStore.getState().updateDraftWall(noSnap);
    editorStore.setState({ selectedWallId: "old-wall", placementPresetId: "bed-single" });

    const document = {
      ...createEmptyDocument(),
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 3000, y: 0 } },
      ],
      walls: [{ id: "new-wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    };

    loadEditorDocument(document);
    const state = editorStore.getState();
    expect(state.history.document).toEqual(document);
    expect(state.history.past).toEqual([]);
    expect(state.history.future).toEqual([]);
    expect(state.tool).toBe("select");
    expect(state.draftWall).toBeNull();
    expect(state.placementPresetId).toBeNull();
    expect(state.selectedWallId).toBeNull();
    expect(state.selectedRoomId).toBeNull();
    expect(state.selectedOpeningId).toBeNull();
    expect(state.selectedObjectId).toBeNull();
    expect(state.objectGesture).toBeNull();
  });
});
