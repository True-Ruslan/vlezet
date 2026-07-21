import { createWall, type Point2 } from "@vlezet/domain";
import {
  createHistoryState,
  executeCommand,
  redo as redoHistory,
  setWallLength,
  undo as undoHistory,
  type HistoryState,
} from "@vlezet/editor-core";
import type { SnapResult } from "@vlezet/geometry";
import { createStore, type StoreApi } from "zustand/vanilla";

export type EditorTool = "select" | "wall";
export type DraftWall = Readonly<{ start: Point2; end: Point2; snap: SnapResult }>;

export type EditorStoreState = {
  history: HistoryState;
  tool: EditorTool;
  selectedWallId: string | null;
  draftWall: DraftWall | null;
  setTool: (tool: EditorTool) => void;
  selectWall: (wallId: string | null) => void;
  beginWall: (point: Point2) => void;
  updateDraftWall: (snap: SnapResult) => void;
  commitDraftWall: () => void;
  cancelDraft: () => void;
  setSelectedWallLength: (lengthMm: number) => void;
  undo: () => void;
  redo: () => void;
};

export type CreateEditorStoreOptions = Readonly<{
  idFactory?: () => string;
  defaultWallThicknessMm?: number;
}>;

function emptySnap(point: Point2): SnapResult {
  return { point, kind: "none", guides: [] };
}

function selectionAfterHistory(history: HistoryState, selectedWallId: string | null): string | null {
  if (!selectedWallId) return null;
  return history.document.walls.some((wall) => wall.id === selectedWallId) ? selectedWallId : null;
}

export function createEditorStore(options: CreateEditorStoreOptions = {}): StoreApi<EditorStoreState> {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const defaultWallThicknessMm = options.defaultWallThicknessMm ?? 150;

  return createStore<EditorStoreState>((set, get) => ({
    history: createHistoryState(),
    tool: "select",
    selectedWallId: null,
    draftWall: null,

    setTool: (tool) => set({ tool, draftWall: tool === "wall" ? get().draftWall : null }),
    selectWall: (wallId) => set({ selectedWallId: wallId }),
    beginWall: (point) => set({ draftWall: { start: point, end: point, snap: emptySnap(point) } }),
    updateDraftWall: (snap) => {
      const current = get().draftWall;
      if (!current) return;
      set({ draftWall: { ...current, end: snap.point, snap } });
    },
    commitDraftWall: () => {
      const current = get().draftWall;
      if (!current) return;
      if (current.start.x === current.end.x && current.start.y === current.end.y) return;

      const wall = createWall({
        id: idFactory(),
        start: current.start,
        end: current.end,
        thickness: defaultWallThicknessMm,
      });
      const history = executeCommand(get().history, { type: "wall/add", wall });
      const chainPoint = current.end;
      set({
        history,
        selectedWallId: wall.id,
        draftWall: get().tool === "wall" ? { start: chainPoint, end: chainPoint, snap: emptySnap(chainPoint) } : null,
      });
    },
    cancelDraft: () => set({ draftWall: null }),
    setSelectedWallLength: (lengthMm) => {
      const { history, selectedWallId } = get();
      if (!selectedWallId) return;
      const wall = history.document.walls.find((item) => item.id === selectedWallId);
      if (!wall) return;
      const resized = setWallLength(wall, lengthMm);
      set({ history: executeCommand(history, { type: "wall/replace", before: wall, after: resized }) });
    },
    undo: () => {
      const current = get();
      const history = undoHistory(current.history);
      set({ history, draftWall: null, selectedWallId: selectionAfterHistory(history, current.selectedWallId) });
    },
    redo: () => {
      const current = get();
      const history = redoHistory(current.history);
      set({ history, draftWall: null, selectedWallId: selectionAfterHistory(history, current.selectedWallId) });
    },
  }));
}

export const editorStore = createEditorStore();
