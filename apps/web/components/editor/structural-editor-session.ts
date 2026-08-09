import type { Point2, VlezetDocument } from "@vlezet/domain";
import {
  createStructuralClipboardPayload,
  cutStructuralFragment,
  evaluateStructuralClipboardClosure,
  evaluateStructuralVertexMove,
  evaluateStructuralWallTranslation,
  evaluateWallThicknessBatch,
  executeCommand,
  pasteStructuralFragment,
  type StructuralClipboardPayloadV1,
} from "@vlezet/editor-core";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  addToSelection,
  EMPTY_EDITOR_SELECTION,
  replaceSelection,
  sanitizeEditorSelection,
  type EditorSelection,
} from "./editor-selection";
import { editorStore, type EditorStoreState } from "./use-editor-store";

export type StructuralGesture = Readonly<{
  kind: "move-vertex" | "translate-wall";
  entityId: string;
  before: VlezetDocument;
  previewDocument: VlezetDocument;
  valid: boolean;
  reason: string | null;
  changed: boolean;
}>;

export type StructuralEditorSessionState = {
  gesture: StructuralGesture | null;
  clipboard: StructuralClipboardPayloadV1 | null;
  lastPasteAnchor: Point2 | null;
  repeatedPasteCount: number;
  beginVertexGesture: (vertexId: string) => void;
  beginWallGesture: (wallId: string) => void;
  previewVertexGesture: (position: Point2) => void;
  previewWallGesture: (delta: Point2) => void;
  commitGesture: () => void;
  cancelGesture: () => void;
  setSelectedWallsThickness: (thicknessMm: number) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: (anchor: Point2) => void;
  duplicateSelection: () => void;
};

export type CreateStructuralEditorSessionOptions = Readonly<{
  idFactory?: (kind: "vertex" | "wall" | "opening") => string;
}>;

const REPEATED_PASTE_OFFSET_MM = 250;

function selectedWallIds(selection: EditorSelection): readonly string[] | null {
  if (selection.refs.length === 0 || selection.refs.some((ref) => ref.kind !== "wall")) return null;
  return selection.refs.map((ref) => ref.id);
}

function selectionForWalls(document: VlezetDocument, wallIds: readonly string[]): EditorSelection {
  const [first, ...rest] = wallIds;
  if (!first) return EMPTY_EDITOR_SELECTION;
  return sanitizeEditorSelection(
    document,
    addToSelection(
      replaceSelection({ kind: "wall", id: first }),
      rest.map((id) => ({ kind: "wall" as const, id })),
    ),
  );
}

function samePoint(first: Point2 | null, second: Point2): boolean {
  return first !== null && first.x === second.x && first.y === second.y;
}

function meaningfulDelta(delta: Point2): boolean {
  return delta.x !== 0 || delta.y !== 0;
}

function wallBounds(document: VlezetDocument, wallIds: readonly string[]) {
  const selected = new Set(wallIds);
  const vertexIds = new Set<string>();
  for (const wall of document.walls) {
    if (!selected.has(wall.id)) continue;
    vertexIds.add(wall.startVertexId);
    vertexIds.add(wall.endVertexId);
    for (const junctionId of wall.junctionVertexIds) vertexIds.add(junctionId);
  }
  const vertices = document.vertices.filter((vertex) => vertexIds.has(vertex.id));
  if (vertices.length === 0) return null;
  const xs = vertices.map((vertex) => vertex.position.x);
  const ys = vertices.map((vertex) => vertex.position.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function createStructuralEditorSession(
  editor: StoreApi<EditorStoreState>,
  options: CreateStructuralEditorSessionOptions = {},
): StoreApi<StructuralEditorSessionState> {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());

  return createStore<StructuralEditorSessionState>((set, get) => ({
    gesture: null,
    clipboard: null,
    lastPasteAnchor: null,
    repeatedPasteCount: 0,

    beginVertexGesture: (vertexId) => {
      const before = editor.getState().history.document;
      if (!before.vertices.some((vertex) => vertex.id === vertexId)) return;
      editor.setState({ objectGesture: null, placementPresetId: null, tool: "select" });
      set({
        gesture: {
          kind: "move-vertex",
          entityId: vertexId,
          before,
          previewDocument: before,
          valid: true,
          reason: null,
          changed: false,
        },
      });
    },

    beginWallGesture: (wallId) => {
      const before = editor.getState().history.document;
      if (!before.walls.some((wall) => wall.id === wallId)) return;
      editor.setState({ objectGesture: null, placementPresetId: null, tool: "select" });
      set({
        gesture: {
          kind: "translate-wall",
          entityId: wallId,
          before,
          previewDocument: before,
          valid: true,
          reason: null,
          changed: false,
        },
      });
    },

    previewVertexGesture: (position) => {
      const gesture = get().gesture;
      if (!gesture || gesture.kind !== "move-vertex") return;
      const beforeVertex = gesture.before.vertices.find((vertex) => vertex.id === gesture.entityId);
      if (!beforeVertex) return;
      const changed = beforeVertex.position.x !== position.x || beforeVertex.position.y !== position.y;
      const result = evaluateStructuralVertexMove(gesture.before, gesture.entityId, position);
      set({
        gesture: {
          ...gesture,
          previewDocument: result.ok ? result.document : (result.candidate ?? gesture.before),
          valid: result.ok,
          reason: result.ok ? null : result.reason,
          changed,
        },
      });
    },

    previewWallGesture: (delta) => {
      const gesture = get().gesture;
      if (!gesture || gesture.kind !== "translate-wall") return;
      const result = evaluateStructuralWallTranslation(gesture.before, gesture.entityId, delta);
      set({
        gesture: {
          ...gesture,
          previewDocument: result.ok ? result.document : (result.candidate ?? gesture.before),
          valid: result.ok,
          reason: result.ok ? null : result.reason,
          changed: meaningfulDelta(delta),
        },
      });
    },

    commitGesture: () => {
      const gesture = get().gesture;
      if (!gesture) return;
      if (!gesture.valid) return;
      if (!gesture.changed) {
        set({ gesture: null });
        return;
      }

      const state = editor.getState();
      if (state.history.document !== gesture.before) {
        set({
          gesture: {
            ...gesture,
            valid: false,
            reason: "Документ изменился во время структурного жеста",
          },
        });
        return;
      }

      const after = gesture.previewDocument;
      const label = gesture.kind === "move-vertex" ? "vertex/move-structural" : "wall/translate";
      editor.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label,
          before: gesture.before,
          after,
        }),
        selection: sanitizeEditorSelection(after, state.selection),
        objectGesture: null,
        placementPresetId: null,
      });
      set({ gesture: null });
    },

    cancelGesture: () => set({ gesture: null }),

    setSelectedWallsThickness: (thicknessMm) => {
      const state = editor.getState();
      const wallIds = selectedWallIds(state.selection);
      if (!wallIds) return;
      const before = state.history.document;
      const result = evaluateWallThicknessBatch(before, wallIds, thicknessMm);
      if (!result.ok || result.document === before) return;
      editor.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "wall/batch-set-thickness",
          before,
          after: result.document,
        }),
        selection: sanitizeEditorSelection(result.document, state.selection),
      });
    },

    copySelection: () => {
      const state = editor.getState();
      const wallIds = selectedWallIds(state.selection);
      if (!wallIds) return;
      const closure = evaluateStructuralClipboardClosure(state.history.document, wallIds);
      if (!closure.ok) return;
      set({
        clipboard: createStructuralClipboardPayload(state.history.document, closure.wallIds),
        lastPasteAnchor: null,
        repeatedPasteCount: 0,
      });
    },

    cutSelection: () => {
      const state = editor.getState();
      const wallIds = selectedWallIds(state.selection);
      if (!wallIds) return;
      let result: ReturnType<typeof cutStructuralFragment>;
      try {
        result = cutStructuralFragment(state.history.document, wallIds);
      } catch {
        return;
      }
      editor.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "structure/cut",
          before: state.history.document,
          after: result.document,
        }),
        selection: sanitizeEditorSelection(result.document, state.selection),
        objectGesture: null,
        placementPresetId: null,
        tool: "select",
      });
      set({
        clipboard: result.payload,
        lastPasteAnchor: null,
        repeatedPasteCount: 0,
        gesture: null,
      });
    },

    pasteClipboard: (anchor) => {
      const state = editor.getState();
      const payload = get().clipboard;
      if (!payload) return;
      const repetition = samePoint(get().lastPasteAnchor, anchor) ? get().repeatedPasteCount : 0;
      const effectiveAnchor = {
        x: anchor.x + repetition * REPEATED_PASTE_OFFSET_MM,
        y: anchor.y + repetition * REPEATED_PASTE_OFFSET_MM,
      };
      let pasted: ReturnType<typeof pasteStructuralFragment>;
      try {
        pasted = pasteStructuralFragment(state.history.document, payload, effectiveAnchor, idFactory);
      } catch {
        return;
      }
      editor.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "structure/paste",
          before: state.history.document,
          after: pasted.document,
        }),
        selection: selectionForWalls(pasted.document, pasted.wallIds),
        objectGesture: null,
        placementPresetId: null,
        tool: "select",
      });
      set({
        lastPasteAnchor: { ...anchor },
        repeatedPasteCount: repetition + 1,
        gesture: null,
      });
    },

    duplicateSelection: () => {
      const state = editor.getState();
      const wallIds = selectedWallIds(state.selection);
      if (!wallIds) return;
      const closure = evaluateStructuralClipboardClosure(state.history.document, wallIds);
      if (!closure.ok) return;
      const bounds = wallBounds(state.history.document, closure.wallIds);
      if (!bounds) return;
      const payload = createStructuralClipboardPayload(state.history.document, closure.wallIds);
      const offset = Math.max(
        bounds.maxX - bounds.minX,
        bounds.maxY - bounds.minY,
        REPEATED_PASTE_OFFSET_MM,
      ) + REPEATED_PASTE_OFFSET_MM;
      let pasted: ReturnType<typeof pasteStructuralFragment>;
      try {
        pasted = pasteStructuralFragment(
          state.history.document,
          payload,
          { x: payload.origin.x + offset, y: payload.origin.y + offset },
          idFactory,
        );
      } catch {
        return;
      }
      editor.setState({
        history: executeCommand(state.history, {
          type: "document/replace",
          label: "structure/paste",
          before: state.history.document,
          after: pasted.document,
        }),
        selection: selectionForWalls(pasted.document, pasted.wallIds),
        objectGesture: null,
        placementPresetId: null,
        tool: "select",
      });
      set({ gesture: null });
    },
  }));
}

export const structuralEditorSession = createStructuralEditorSession(editorStore);
