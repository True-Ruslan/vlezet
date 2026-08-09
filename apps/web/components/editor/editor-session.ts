import type { VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { EMPTY_EDITOR_SELECTION } from "./editor-selection";
import { editorStore } from "./use-editor-store";

export function loadEditorDocument(document: VlezetDocument): void {
  editorStore.setState({
    history: createHistoryState(document),
    tool: "select",
    selection: EMPTY_EDITOR_SELECTION,
    placementPresetId: null,
    draftWall: null,
    objectGesture: null,
  });
}
