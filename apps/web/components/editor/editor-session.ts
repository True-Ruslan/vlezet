import type { Point2, VlezetDocument } from "@vlezet/domain";
import { createHistoryState, evaluateHostedOpeningMove } from "@vlezet/editor-core";
import {
  EMPTY_EDITOR_SELECTION,
  replaceSelection,
  sanitizeEditorSelection,
} from "./editor-selection";
import { editorStore, type EditorStoreState } from "./use-editor-store";

function beginHostedOpeningGesture(openingId: string): void {
  const state = editorStore.getState();
  if (!state.history.document.openings.some((opening) => opening.id === openingId)) return;
  editorStore.setState({
    structuralGesture: {
      kind: "translate-opening",
      entityId: openingId,
      before: state.history.document,
      previewDocument: state.history.document,
      valid: true,
      reason: null,
      changed: false,
    },
    objectGesture: null,
    placementPresetId: null,
    selection: sanitizeEditorSelection(
      state.history.document,
      replaceSelection({ kind: "opening", id: openingId }),
    ),
    tool: "select",
  });
}

function previewHostedOpeningGesture(pointerWorld: Point2): void {
  const gesture = editorStore.getState().structuralGesture;
  if (!gesture || gesture.kind !== "translate-opening") return;
  const source = gesture.before.openings.find((opening) => opening.id === gesture.entityId);
  if (!source) return;
  const result = evaluateHostedOpeningMove(gesture.before, gesture.entityId, pointerWorld);
  const previewDocument = result.ok ? result.document : (result.candidate ?? gesture.before);
  const previewOpening = previewDocument.openings.find((opening) => opening.id === gesture.entityId);
  editorStore.setState({
    structuralGesture: {
      ...gesture,
      previewDocument,
      valid: result.ok,
      reason: result.ok ? null : result.reason,
      changed: previewOpening ? previewOpening.offset !== source.offset : false,
    },
  });
}

export function ensureEditorStoreRuntimeActions(): void {
  const current = editorStore.getState();
  const repairs: Partial<EditorStoreState> = {};

  if (typeof current.beginStructuralOpeningGesture !== "function") {
    repairs.beginStructuralOpeningGesture = beginHostedOpeningGesture;
  }
  if (typeof current.previewStructuralOpeningGesture !== "function") {
    repairs.previewStructuralOpeningGesture = previewHostedOpeningGesture;
  }

  if (Object.keys(repairs).length > 0) {
    editorStore.setState(repairs);
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

// Turbopack/Fast Refresh can preserve the live Zustand singleton while newer
// modules expect opening actions that were added after the singleton was created.
// Repair only the missing opening actions and bind them directly to the live store.
ensureEditorStoreRuntimeActions();
