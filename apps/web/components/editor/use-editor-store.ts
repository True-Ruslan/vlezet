import { getVertex, type Point2 } from "@vlezet/domain";
import {
  addTopologicalWall,
  createHistoryState,
  executeCommand,
  redo as redoHistory,
  setRoomName,
  setTopologicalWallLength,
  setWallThickness,
  undo as undoHistory,
  type HistoryState,
  type WallEndpointIntent,
} from "@vlezet/editor-core";
import { deriveRooms, type SnapResult } from "@vlezet/geometry";
import { createStore, type StoreApi } from "zustand/vanilla";

export type EditorTool = "select" | "wall";
export type EditorEntityIdKind = "wall" | "vertex" | "room-annotation";

export type TopologySnapTarget =
  | Readonly<{ kind: "vertex"; vertexId: string; point: Point2 }>
  | Readonly<{ kind: "wall"; wallId: string; point: Point2 }>;

export type DraftWall = Readonly<{
  start: Point2;
  end: Point2;
  snap: SnapResult;
  startTarget: TopologySnapTarget | null;
  endTarget: TopologySnapTarget | null;
}>;

export type EditorStoreState = {
  history: HistoryState;
  tool: EditorTool;
  selectedWallId: string | null;
  selectedRoomId: string | null;
  draftWall: DraftWall | null;
  setTool: (tool: EditorTool) => void;
  selectWall: (wallId: string | null) => void;
  selectRoom: (roomId: string | null) => void;
  beginWall: (point: Point2, target?: TopologySnapTarget | null) => void;
  updateDraftWall: (snap: SnapResult, target?: TopologySnapTarget | null) => void;
  commitDraftWall: () => void;
  cancelDraft: () => void;
  setSelectedWallLength: (lengthMm: number) => void;
  setSelectedWallThickness: (thicknessMm: number) => void;
  setSelectedRoomName: (name: string) => void;
  undo: () => void;
  redo: () => void;
};

export type CreateEditorStoreOptions = Readonly<{
  idFactory?: (kind: EditorEntityIdKind) => string;
  defaultWallThicknessMm?: number;
}>;

function emptySnap(point: Point2): SnapResult {
  return { point, kind: "none", guides: [] };
}

function selectedWallAfterHistory(history: HistoryState, selectedWallId: string | null): string | null {
  if (!selectedWallId) return null;
  return history.document.walls.some((wall) => wall.id === selectedWallId) ? selectedWallId : null;
}

function selectedRoomAfterHistory(history: HistoryState, selectedRoomId: string | null): string | null {
  if (!selectedRoomId) return null;
  return deriveRooms(history.document).rooms.some((room) => room.id === selectedRoomId) ? selectedRoomId : null;
}

function targetPoint(point: Point2, target: TopologySnapTarget | null): Point2 {
  return target ? target.point : point;
}

function endpointIntent(
  point: Point2,
  target: TopologySnapTarget | null,
  idFactory: (kind: EditorEntityIdKind) => string,
): WallEndpointIntent {
  if (target?.kind === "vertex") return { kind: "existing-vertex", vertexId: target.vertexId };
  if (target?.kind === "wall") {
    return {
      kind: "wall-junction",
      vertexId: idFactory("vertex"),
      wallId: target.wallId,
      position: target.point,
    };
  }
  return { kind: "new-vertex", vertexId: idFactory("vertex"), position: point };
}

export function createEditorStore(options: CreateEditorStoreOptions = {}): StoreApi<EditorStoreState> {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const defaultWallThicknessMm = options.defaultWallThicknessMm ?? 150;

  return createStore<EditorStoreState>((set, get) => ({
    history: createHistoryState(),
    tool: "select",
    selectedWallId: null,
    selectedRoomId: null,
    draftWall: null,

    setTool: (tool) => set({ tool, draftWall: tool === "wall" ? get().draftWall : null }),
    selectWall: (wallId) => set({ selectedWallId: wallId, selectedRoomId: null }),
    selectRoom: (roomId) => set({ selectedRoomId: roomId, selectedWallId: null }),
    beginWall: (point, target = null) => {
      const resolved = targetPoint(point, target);
      set({
        draftWall: {
          start: resolved,
          end: resolved,
          snap: emptySnap(resolved),
          startTarget: target,
          endTarget: null,
        },
      });
    },
    updateDraftWall: (snap, target = null) => {
      const current = get().draftWall;
      if (!current) return;
      const end = targetPoint(snap.point, target);
      set({ draftWall: { ...current, end, snap: { ...snap, point: end }, endTarget: target } });
    },
    commitDraftWall: () => {
      const current = get().draftWall;
      if (!current) return;
      if (current.start.x === current.end.x && current.start.y === current.end.y) return;

      const before = get().history.document;
      const start = endpointIntent(current.start, current.startTarget, idFactory);
      const end = endpointIntent(current.end, current.endTarget, idFactory);
      const wallId = idFactory("wall");
      const edit = addTopologicalWall(before, { wallId, start, end, thickness: defaultWallThicknessMm });
      const label = start.kind === "wall-junction" || end.kind === "wall-junction"
        ? "wall/add-t-junction"
        : "wall/add-connected";
      const history = executeCommand(get().history, {
        type: "document/replace",
        label,
        before,
        after: edit.document,
      });

      const continuationVertexId = edit.continuationVertexId;
      const continuation = continuationVertexId ? getVertex(edit.document, continuationVertexId) : null;
      const continuationTarget = continuation
        ? ({ kind: "vertex", vertexId: continuation.id, point: continuation.position } as const)
        : null;

      set({
        history,
        selectedWallId: edit.selectedWallId ?? wallId,
        selectedRoomId: null,
        draftWall: get().tool === "wall" && continuation
          ? {
              start: continuation.position,
              end: continuation.position,
              snap: emptySnap(continuation.position),
              startTarget: continuationTarget,
              endTarget: null,
            }
          : null,
      });
    },
    cancelDraft: () => set({ draftWall: null }),
    setSelectedWallLength: (lengthMm) => {
      const { history, selectedWallId } = get();
      if (!selectedWallId) return;
      const before = history.document;
      const after = setTopologicalWallLength(before, selectedWallId, lengthMm);
      set({ history: executeCommand(history, { type: "document/replace", label: "wall/set-length", before, after }) });
    },
    setSelectedWallThickness: (thicknessMm) => {
      const { history, selectedWallId } = get();
      if (!selectedWallId) return;
      const before = history.document;
      const after = setWallThickness(before, selectedWallId, thicknessMm);
      set({ history: executeCommand(history, { type: "document/replace", label: "wall/set-thickness", before, after }) });
    },
    setSelectedRoomName: (name) => {
      const { history, selectedRoomId } = get();
      if (!selectedRoomId) return;
      const before = history.document;
      const after = setRoomName(before, selectedRoomId, name, idFactory("room-annotation"));
      set({ history: executeCommand(history, { type: "document/replace", label: "room-annotation/set-name", before, after }) });
    },
    undo: () => {
      const current = get();
      const history = undoHistory(current.history);
      set({
        history,
        draftWall: null,
        selectedWallId: selectedWallAfterHistory(history, current.selectedWallId),
        selectedRoomId: selectedRoomAfterHistory(history, current.selectedRoomId),
      });
    },
    redo: () => {
      const current = get();
      const history = redoHistory(current.history);
      set({
        history,
        draftWall: null,
        selectedWallId: selectedWallAfterHistory(history, current.selectedWallId),
        selectedRoomId: selectedRoomAfterHistory(history, current.selectedRoomId),
      });
    },
  }));
}

export const editorStore = createEditorStore();
