import type { VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { editorStore } from "./use-editor-store";

export function loadEditorDocument(document: VlezetDocument): void {
  editorStore.setState({
    history: createHistoryState(document),
    tool: "select",
    selectedWallId: null,
    selectedRoomId: null,
    selectedOpeningId: null,
    selectedObjectId: null,
    placementPresetId: null,
    draftWall: null,
    objectGesture: null,
  });
}
