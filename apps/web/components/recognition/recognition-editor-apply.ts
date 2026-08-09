import type { VlezetDocument } from "@vlezet/domain";
import { executeCommand } from "@vlezet/editor-core";
import type { StoreApi } from "zustand/vanilla";
import { EMPTY_EDITOR_SELECTION } from "../editor/editor-selection";
import type { EditorStoreState } from "../editor/use-editor-store";

export function commitRecognitionDocument(
  store: StoreApi<EditorStoreState>,
  after: VlezetDocument,
): void {
  const current = store.getState();
  const before = current.history.document;
  if (before === after) return;
  const history = executeCommand(current.history, {
    type: "document/replace",
    label: "recognition/apply",
    before,
    after,
  });
  store.setState({
    history,
    tool: "select",
    selection: EMPTY_EDITOR_SELECTION,
    placementPresetId: null,
    draftWall: null,
    objectGesture: null,
  });
}
