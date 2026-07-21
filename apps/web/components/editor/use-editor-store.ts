import { getVertex, type Point2 } from "@vlezet/domain";
import {
  addOpening,
  addTopologicalWall,
  createHistoryState,
  deleteOpening,
  executeCommand,
  redo as redoHistory,
  setRoomName,
  setTopologicalWallLength,
  setWallThickness,
  undo as undoHistory,
  updateOpening,
  type HistoryState,
  type OpeningPatch,
  type WallEndpointIntent,
} from "@vlezet/editor-core";
import { deriveRooms, proposeOpeningPlacement, type SnapResult } from "@vlezet/geometry";
import { createStore, type StoreApi } from "zustand/vanilla";

export type EditorTool = "select" | "wall" | "door" | "window";
export type EditorEntityIdKind = "wall" | "vertex" | "room-annotation" | "opening";

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
  selectedOpeningId: string | null;
  draftWall: DraftWall | null;
  setTool: (tool: EditorTool) => void;
  selectWall: (wallId: string | null) => void;
  selectRoom: (roomId: string | null) => void;
  selectOpening: (openingId: string | null) => void;
  beginWall: (point: Point2, target?: TopologySnapTarget | null) => void;
  updateDraftWall: (snap: SnapResult, target?: TopologySnapTarget | null) => void;
  commitDraftWall: () => void;
  cancelDraft: () => void;
  setSelectedWallLength: (lengthMm: number) => void;
  setSelectedWallThickness: (thicknessMm: number) => void;
  setSelectedRoomName: (name: string) => void;
  addOpeningAt: (wallId: string, pointerOffset: number) => void;
  updateSelectedOpening: (patch: OpeningPatch) => void;
  deleteSelectedOpening: () => void;
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

function selectedWallAfterHistory(history: HistoryState, id: string | null): string | null {
  return id && history.document.walls.some((wall) => wall.id === id) ? id : null;
}
function selectedRoomAfterHistory(history: HistoryState, id: string | null): string | null {
  return id && deriveRooms(history.document).rooms.some((room) => room.id === id) ? id : null;
}
function selectedOpeningAfterHistory(history: HistoryState, id: string | null): string | null {
  return id && history.document.openings.some((opening) => opening.id === id) ? id : null;
}
function targetPoint(point: Point2, target: TopologySnapTarget | null): Point2 {
  return target ? target.point : point;
}
function endpointIntent(point: Point2, target: TopologySnapTarget | null, idFactory: (kind: EditorEntityIdKind) => string): WallEndpointIntent {
  if (target?.kind === "vertex") return { kind: "existing-vertex", vertexId: target.vertexId };
  if (target?.kind === "wall") return { kind: "wall-junction", vertexId: idFactory("vertex"), wallId: target.wallId, position: target.point };
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
    selectedOpeningId: null,
    draftWall: null,

    setTool: (tool) => set({ tool, draftWall: tool === "wall" ? get().draftWall : null }),
    selectWall: (selectedWallId) => set({ selectedWallId, selectedRoomId: null, selectedOpeningId: null }),
    selectRoom: (selectedRoomId) => set({ selectedRoomId, selectedWallId: null, selectedOpeningId: null }),
    selectOpening: (selectedOpeningId) => set({ selectedOpeningId, selectedWallId: null, selectedRoomId: null }),
    beginWall: (point, target = null) => {
      const resolved = targetPoint(point, target);
      set({ draftWall: { start: resolved, end: resolved, snap: emptySnap(resolved), startTarget: target, endTarget: null } });
    },
    updateDraftWall: (snap, target = null) => {
      const current = get().draftWall;
      if (!current) return;
      const end = targetPoint(snap.point, target);
      set({ draftWall: { ...current, end, snap: { ...snap, point: end }, endTarget: target } });
    },
    commitDraftWall: () => {
      const current = get().draftWall;
      if (!current || (current.start.x === current.end.x && current.start.y === current.end.y)) return;
      const before = get().history.document;
      const start = endpointIntent(current.start, current.startTarget, idFactory);
      const end = endpointIntent(current.end, current.endTarget, idFactory);
      const wallId = idFactory("wall");
      const edit = addTopologicalWall(before, { wallId, start, end, thickness: defaultWallThicknessMm });
      const label = start.kind === "wall-junction" || end.kind === "wall-junction" ? "wall/add-t-junction" : "wall/add-connected";
      const history = executeCommand(get().history, { type: "document/replace", label, before, after: edit.document });
      const continuation = edit.continuationVertexId ? getVertex(edit.document, edit.continuationVertexId) : null;
      const continuationTarget = continuation ? ({ kind: "vertex", vertexId: continuation.id, point: continuation.position } as const) : null;
      set({
        history,
        selectedWallId: edit.selectedWallId ?? wallId,
        selectedRoomId: null,
        selectedOpeningId: null,
        draftWall: get().tool === "wall" && continuation ? {
          start: continuation.position,
          end: continuation.position,
          snap: emptySnap(continuation.position),
          startTarget: continuationTarget,
          endTarget: null,
        } : null,
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
    addOpeningAt: (wallId, pointerOffset) => {
      const { history, tool } = get();
      if (tool !== "door" && tool !== "window") return;
      const width = tool === "door" ? 900 : 1200;
      const placement = proposeOpeningPlacement(history.document, wallId, pointerOffset, width);
      const opening = {
        id: idFactory("opening"),
        wallId,
        kind: tool,
        ...placement,
        ...(tool === "door" ? { doorSwing: { hinge: "start" as const, side: "left" as const } } : {}),
      };
      const before = history.document;
      const after = addOpening(before, opening);
      set({
        history: executeCommand(history, { type: "document/replace", label: "opening/add", before, after }),
        selectedOpeningId: opening.id,
        selectedWallId: null,
        selectedRoomId: null,
      });
    },
    updateSelectedOpening: (patch) => {
      const { history, selectedOpeningId } = get();
      if (!selectedOpeningId) return;
      const before = history.document;
      const after = updateOpening(before, selectedOpeningId, patch);
      set({ history: executeCommand(history, { type: "document/replace", label: "opening/update", before, after }) });
    },
    deleteSelectedOpening: () => {
      const { history, selectedOpeningId } = get();
      if (!selectedOpeningId) return;
      const before = history.document;
      const after = deleteOpening(before, selectedOpeningId);
      set({
        history: executeCommand(history, { type: "document/replace", label: "opening/delete", before, after }),
        selectedOpeningId: null,
      });
    },
    undo: () => {
      const current = get();
      const history = undoHistory(current.history);
      set({ history, draftWall: null, selectedWallId: selectedWallAfterHistory(history, current.selectedWallId), selectedRoomId: selectedRoomAfterHistory(history, current.selectedRoomId), selectedOpeningId: selectedOpeningAfterHistory(history, current.selectedOpeningId) });
    },
    redo: () => {
      const current = get();
      const history = redoHistory(current.history);
      set({ history, draftWall: null, selectedWallId: selectedWallAfterHistory(history, current.selectedWallId), selectedRoomId: selectedRoomAfterHistory(history, current.selectedRoomId), selectedOpeningId: selectedOpeningAfterHistory(history, current.selectedOpeningId) });
    },
  }));
}

export const editorStore = createEditorStore();
