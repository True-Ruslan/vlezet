import type { VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { EMPTY_EDITOR_SELECTION } from "./editor-selection";
import { createEditorStore, editorStore, type EditorStoreState } from "./use-editor-store";

export function ensureEditorStoreRuntimeActions(): void {
  const current = editorStore.getState() as unknown as Record<string, unknown>;
  const fresh = createEditorStore().getState() as unknown as Record<string, unknown>;
  const repairs: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fresh)) {
    if (typeof value === "function" && typeof current[key] !== "function") {
      repairs[key] = value;
    }
  }

  if (Object.keys(repairs).length > 0) {
    editorStore.setState(repairs as Partial<EditorStoreState>);
  }
}

export function loadEditorDocument(document: VlezetDocument): void {
  ensureEditorStoreRuntimeActions();
  editorStore.setState({
    history: createHistoryState(document),
    tool: "select",
    selection: EMPTY_EDITOR_SELECTION,
    placementPresetId: null,
    draftWall: null,
    objectGesture: null,
  });
}

// Fast Refresh can preserve a live Zustand singleton while replacing modules that
// add newer actions. Reconcile the action surface on module evaluation without
// touching document/runtime state when the store shape is already current.
ensureEditorStoreRuntimeActions();
